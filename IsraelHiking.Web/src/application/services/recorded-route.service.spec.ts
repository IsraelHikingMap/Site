import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { RecordedRouteService } from "./recorded-route.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { GeoLocationService } from "./geo-location.service";
import { ResourcesService } from "./resources.service";
import { TracesService } from "./traces.service";
import { RoutesFactory } from "./routes.factory";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { RunningContextService } from "./running-context.service";
import { ConnectionService } from "./connection.service";
import { RecordedRouteReducer, StopRecordingAction } from "../reducers/recorded-route.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import type { ApplicationState, MarkerData } from "../models/models";
import { GpsReducer, SetCurrentPositionAction } from "application/reducers/gps.reducer";

describe("Recorded Route Service", () => {

    const positionChanged = (store: Store, newPoistion: any) => {
        store.dispatch(new SetCurrentPositionAction(newPoistion));
    };

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let loggingServiceMock = {
            debug: () => { },
            info: () => { }
        };
        let tracesServiceMock = {
            uploadLocalTracesIfNeeded: () => Promise.resolve()
        };
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([GpsReducer, RecordedRouteReducer]),
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: ToastService, useValue: toastMock.toastService },
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: TracesService, useValue: tracesServiceMock },
                GeoLocationService,
                RunningContextService,
                ConnectionService,
                RoutesFactory,
                RecordedRouteService
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
            expect(service.isRecording()).toBeFalse();
        }
    ));

    it("Should initialize after a recording stopped in the middle and stop the recording gracefully",
        inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isRecording: true,
                    route: {
                        markers: [],
                        latlngs: [{
                            lat: 1,
                            lng: 2,
                            alt: 10,
                            timestamp: new Date(0)}
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
            let spy = jasmine.createSpy();
            store.dispatch = spy;
            service.initialize();
            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(StopRecordingAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(AddRouteAction);
        }
    ));

    it("Should not do anything when not recording and a new position is received", done => inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {

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
            service.initialize();

            positionChanged(store, { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(1).getTime() });

            setTimeout(() => {
                expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(0);
                done();
            }, 10);
        }
    )());

    it("Should add a valid location", done => inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isRecording: false
                }
            });
            service.initialize();
            store.reset({
                gpsState: {
                    currentPosition: {
                        coords: {
                            latitude: 1,
                            loggitude: 2,
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                },
                recordedRouteState: {
                    route: {}
                },
            });
            service.startRecording();
            store.reset({
                userState: {},
                gpsState: {},
                recordedRouteState: {
                    route: {
                        latlngs: [{
                            lat: 1,
                            lng: 2,
                            alt: 10,
                            timestamp: new Date(0)
                        }]
                    },
                    isRecording: true
                }
            });

            positionChanged(store, { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(1).getTime()});

            setTimeout(() => {
                expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(1);
                done();
            }, 10);
        }
    )());

    it("Should add a valid locations when returning from background", done => inject([RecordedRouteService, GeoLocationService, Store],
        (service: RecordedRouteService, geoService: GeoLocationService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isRecording: false
                }
            });
            service.initialize();
            store.reset({
                gpsState: {
                    currentPosition: {
                        coords: {
                            latitude: 1,
                            loggitude: 2,
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                },
                recordedRouteState: {
                    route: {}
                },
            });
            service.startRecording();
            store.reset({
                gpsState: {},
                recordedRouteState: {
                    route: {
                        latlngs: [{
                            lat: 1,
                            lng: 2,
                            alt: 10,
                            timestamp: new Date(0)
                        }]
                    },
                    isRecording: true
                }
            });

            geoService.bulkPositionChanged.next([
                {
                    coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(1).getTime()
                },
                {
                    coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(60000).getTime()
                },
                {
                    coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(120000).getTime()
                },
                {
                    coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(180000).getTime()
                }
            ]);
            positionChanged(store,
                { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(240000).getTime()}
            );
            setTimeout(() => {
                expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(5);
                done();
            }, 10);
        }
    )());

    it("Should invalidate multiple locations once", done => inject([RecordedRouteService, GeoLocationService, LoggingService, Store],
        (service: RecordedRouteService, geoService: GeoLocationService,
         logginService: LoggingService, store: Store) => {
            store.reset({
                recordedRouteState: {
                    isRecording: false
                }
            });
            service.initialize();
            store.reset({
                gpsState: {
                    currentPosition: {
                        coords: {
                            latitude: 1,
                            loggitude: 2,
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                },
                recordedRouteState: {
                    route: {}
                },
            });
            let spy = spyOn(logginService, "debug");
            service.startRecording();
            store.reset({
                recordedRouteState: {
                    route: {
                        latlngs: [{
                            lat: 1,
                            lng: 2,
                            alt: 10,
                            timestamp: new Date(0)
                        }]
                    },
                    isRecording: true
                }
            });

            geoService.bulkPositionChanged.next([
                {
                    coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(1).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(150000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(151000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(152000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(152000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2, accuracy: 1000 } as GeolocationCoordinates,
                    timestamp: new Date(153000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates,
                    timestamp: new Date(10000000).getTime()
                }
            ]);
            expect(spy.calls.all()[0].args[0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(spy.calls.all()[1].args[0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(spy.calls.all()[2].args[0].startsWith("[Record] Validating a rejected position")).toBeTruthy();
            expect(spy.calls.all()[3].args[0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(spy.calls.all()[4].args[0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(spy.calls.all()[5].args[0].startsWith("[Record] Rejecting position for rejected")).toBeTruthy();
            expect(spy.calls.all()[6].args[0].startsWith("[Record] Rejecting position for rejected")).toBeTruthy();

            setTimeout(() => {
                expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(4);
                done();
            }, 10);
        })());

    it("should stop recording and send data to traces upload mechanism including one marker",
        inject([RecordedRouteService, Store], (service: RecordedRouteService, store: Store) => {
        store.reset({
            recordedRouteState: {
                isRecording: false
            }
        });
        service.initialize();
        store.reset({
            recordedRouteState: {
                route: {
                    latlngs: [{
                        lat: 1,
                        lng: 2,
                        alt: 10,
                        timestamp: new Date(0)
                    }],
                    markers: [{ description: "desc", title: "mock-marker"} as MarkerData]
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
        let spy = jasmine.createSpy();
        store.dispatch = spy;
        service.stopRecording();

        expect(spy.calls.all().some(c => c.args[0].trace &&
            c.args[0].trace.dataContainer.routes[0].markers.length > 0)).toBeTruthy();
    }));
});
