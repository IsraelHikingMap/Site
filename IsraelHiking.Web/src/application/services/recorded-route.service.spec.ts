import { describe, beforeEach, vi, it, expect } from "vitest";
import { EventEmitter } from "@angular/core";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { TestBed, inject } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { RecordedRouteService } from "./recorded-route.service";
import { GeoLocationService } from "./geo-location.service";
import { ResourcesService } from "./resources.service";
import { TracesService } from "./traces.service";
import { RoutesFactory } from "./routes.factory";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { RunningContextService } from "./running-context.service";
import { StopRecordingAction, RecordedRouteReducer } from "../reducers/recorded-route.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import { GpsReducer } from "../reducers/gps.reducer";
import type { ApplicationState, MarkerData } from "../models";

function createGeoLocationServiceStub() {
    return {
        positionsReceived: new EventEmitter<GeolocationPosition[]>(),
        backToForeground: new EventEmitter<void>(),
        readLocationLog: () => Promise.resolve([])
    };
}

function createPosition(time: number): GeolocationPosition {
    return { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(time).getTime() } as GeolocationPosition;
}

function resetToRecordingStartPosition(store: Store) {
    store.reset({
        recordedRouteState: {
            isRecording: false,
            route: {}
        },
        gpsState: {
            currentPosition: {
                coords: {
                    latitude: 1,
                    loggitude: 2,
                    altitude: 10
                },
                timestamp: new Date(0).getTime()
            }
        }
    });
}

describe("Recorded Route Service", () => {
    beforeEach(() => {
        const loggingServiceMock = {
            debug: () => { },
            info: () => { },
            error: () => { }
        };
        const tracesServiceMock = {
            uploadLocalTracesIfNeeded: () => Promise.resolve()
        };
        const runnningContextServiceMock = {
            isCapacitor: true
        };
        TestBed.configureTestingModule({
            providers: [
                provideStore([GpsReducer, RecordedRouteReducer]),
                { provide: ResourcesService, useValue: {} },
                {
                    provide: ToastService,
                    useValue: {
                        warning: vi.fn()
                    }
                },
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: TracesService, useValue: tracesServiceMock },
                {
                    provide: RunningContextService,
                    useValue: runnningContextServiceMock
                },
                {
                    provide: GeoLocationService,
                    useValue: createGeoLocationServiceStub()
                },
                RoutesFactory,
                RecordedRouteService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get recording from state", inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isRecording: false
                }
            });
            expect(service.isRecording()).toBeFalsy();
        }
    ));

    it("Should return false for canRecord when in searching state", inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                gpsState: {
                    tracking: "searching"
                }
            });
            expect(service.canRecord()).toBeFalsy();
        }
    ));

    it("Should return true for canRecord when position is defined", inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                gpsState: {
                    tracking: "tracking",
                    currentPosition: {
                        coords: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }
            });
            expect(service.canRecord()).toBeTruthy();
        }
    ));

    it("Should initialize after a recording stopped in the middle and stop the recording gracefully",
        inject([RecordedRouteService, Store],
            async (service: RecordedRouteService, store: Store) => {
                store.reset({
                    gpsState: {},
                    recordedRouteState: {
                        isRecording: true,
                        route: {
                            markers: [],
                            latlngs: [
                                {
                                    lat: 1,
                                    lng: 2,
                                    alt: 10,
                                    timestamp: new Date(0)
                                }
                            ]
                        }
                    },
                    routeEditingState: {
                        routingType: "Hike"
                    },
                    userState: {
                        userInfo: null
                    }
                });
                const spy = vi.fn();
                store.dispatch = spy;
                await service.initialize();
                expect(vi.mocked(spy).mock.calls[0][0]).toBeInstanceOf(StopRecordingAction);
                expect(vi.mocked(spy).mock.calls[1][0]).toBeInstanceOf(AddRouteAction);
            }
        )
    );

    it("Should add the positions from the location log when initializing after a recording stopped in the middle",
        inject([RecordedRouteService, GeoLocationService, Store],
            async (service: RecordedRouteService, geoService: GeoLocationService, store: Store) => {
                store.reset({
                    gpsState: {},
                    recordedRouteState: {
                        isRecording: true,
                        route: {
                            markers: [],
                            latlngs: [{ lat: 1, lng: 2, alt: 10, timestamp: new Date(0) }]
                        }
                    },
                    routeEditingState: {
                        routingType: "Hike"
                    },
                    userState: {
                        userInfo: null
                    }
                });
                // The first position was already added to the recording before the app was killed.
                vi.spyOn(geoService, "readLocationLog").mockResolvedValue([createPosition(0), createPosition(1000), createPosition(2000)]);
                const spy = vi.spyOn(store, "dispatch");

                await service.initialize();

                const addRouteAction = spy.mock.calls.map(c => c[0]).find(a => a instanceof AddRouteAction) as AddRouteAction;
                expect(addRouteAction.routeData.segments.at(-1).latlngs.map(l => l.timestamp)).toEqual([
                    new Date(0), new Date(1000).toISOString(), new Date(2000).toISOString()
                ]);
            }
        )
    );

    it("Should not do anything when not recording and a new position is received", inject([RecordedRouteService, GeoLocationService, Store],
        async (service: RecordedRouteService, geoService: GeoLocationService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isRecording: false,
                    route: {
                        markers: [],
                        latlngs: []
                    }
                },
                gpsState: {}
            });
            await service.initialize();

            geoService.positionsReceived.next([createPosition(1)]);

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(0);
        }
    ));

    it("Should add a valid location when a position is received", inject([RecordedRouteService, GeoLocationService, Store],
        async (service: RecordedRouteService, geoService: GeoLocationService, store: Store) => {
            resetToRecordingStartPosition(store);
            await service.initialize();
            service.startRecording();

            geoService.positionsReceived.next([createPosition(2)]);

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(2);
        }
    ));

    it("Should add all the locations received while in background", inject([RecordedRouteService, GeoLocationService, Store],
        async (service: RecordedRouteService, geoService: GeoLocationService, store: Store) => {
            resetToRecordingStartPosition(store);
            await service.initialize();
            service.startRecording();

            geoService.positionsReceived.next([createPosition(60000), createPosition(120000), createPosition(180000), createPosition(240000)]);

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(5);
        }
    ));

    it("Should not add the same location twice when it is received again", inject([RecordedRouteService, GeoLocationService, LoggingService, Store],
        async (service: RecordedRouteService, geoService: GeoLocationService, loggingService: LoggingService, store: Store) => {
            resetToRecordingStartPosition(store);
            await service.initialize();
            service.startRecording();
            geoService.positionsReceived.next([createPosition(60000), createPosition(120000), createPosition(180000)]);
            const spy = vi.spyOn(loggingService, "debug");

            geoService.positionsReceived.next([createPosition(120000), createPosition(180000)]);

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(4);
            expect(vi.mocked(spy).mock.calls.some((c) => c[0].startsWith("[Record] Rejecting position"))).toBeFalsy();
        }
    ));

    it("Should invalidate multiple locations once and update recording when coming back to foreground", inject([RecordedRouteService, GeoLocationService, LoggingService, Store],
        async (service: RecordedRouteService, geoService: GeoLocationService, loggingService: LoggingService, store: Store) => {
            resetToRecordingStartPosition(store);
            await service.initialize();
            const spy = vi.spyOn(loggingService, "debug");
            service.startRecording();

            geoService.positionsReceived.next([
                { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(150000).getTime() } as GeolocationPosition,
                { coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(1000).getTime() } as GeolocationPosition,
                { coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(2000).getTime() } as GeolocationPosition,
                { coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(3000).getTime() } as GeolocationPosition,
                { coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(3000).getTime() } as GeolocationPosition,
                { coords: { longitude: 1, latitude: 2, accuracy: 1000 } as GeolocationCoordinates, timestamp: new Date(4000).getTime() } as GeolocationPosition,
                { coords: { longitude: 1.1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(5000).getTime() } as GeolocationPosition
            ]);

            let i = 0;
            expect(vi.mocked(spy).mock.calls[i++][0].startsWith("[Record] Processing 7")).toBeTruthy();
            expect(vi.mocked(spy).mock.calls[i++][0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(vi.mocked(spy).mock.calls[i++][0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(vi.mocked(spy).mock.calls[i++][0].startsWith("[Record] Validating a rejected position")).toBeTruthy();
            expect(vi.mocked(spy).mock.calls[i++][0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(vi.mocked(spy).mock.calls[i++][0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(vi.mocked(spy).mock.calls[i][0].startsWith("[Record] Rejecting position for rejected")).toBeTruthy();
            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(4);
        }
    ));

    it("should stop recording and send data to traces upload mechanism including one marker", inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                gpsState: {},
                recordedRouteState: {
                    isRecording: false
                }
            });
            service.initialize();
            store.reset({
                gpsState: {},
                recordedRouteState: {
                    route: {
                        latlngs: [
                            {
                                lat: 1,
                                lng: 2,
                                alt: 10,
                                timestamp: new Date(0)
                            }
                        ],
                        markers: [
                            { description: "desc", title: "mock-marker" } as MarkerData
                        ]
                    },
                    isRecording: true
                },
                routeEditingState: {
                    routingType: "hike"
                },
                userState: {
                    userInfo: null
                }
            });
            const spy = vi.fn();
            store.dispatch = spy;
            service.stopRecording();

            expect(vi.mocked(spy).mock.calls.some((c) => c[0].trace && c[0].trace.dataContainer.routes[0].markers.length > 0)).toBeTruthy();
        }
    ));
});
