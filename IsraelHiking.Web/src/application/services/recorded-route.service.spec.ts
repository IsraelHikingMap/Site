import { EventEmitter } from "@angular/core";
import { provideHttpClientTesting } from "@angular/common/http/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { TestBed, inject } from "@angular/core/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { RecordedRouteService } from "./recorded-route.service";
import { GeoLocationService } from "./geo-location.service";
import { ResourcesService } from "./resources.service";
import { TracesService } from "./traces.service";
import { RoutesFactory } from "./routes.factory";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { RunningContextService } from "./running-context.service";
import { StopRecordingAction, RecordedRouteReducer, ClearPendingProcessingRoutePointsAction, AddRecordingRoutePointsAction } from "../reducers/recorded-route.reducer";
import { AddRouteAction } from "../reducers/routes.reducer";
import { SetCurrentPositionAction, GpsReducer } from "../reducers/gps.reducer";
import type { ApplicationState, MarkerData } from "../models";

describe("Recorded Route Service", () => {

    const positionChanged = (store: Store, newPoistion: GeolocationPosition) => {
        store.dispatch(new SetCurrentPositionAction(newPoistion));
    };

    beforeEach(() => {
        const loggingServiceMock = {
            debug: () => { },
            info: () => { }
        };
        const tracesServiceMock = {
            uploadLocalTracesIfNeeded: () => Promise.resolve()
        };
        const runnningContextServiceMock = {
            isCapacitor: true
        };
        TestBed.configureTestingModule({
            imports: [NgxsModule.forRoot([GpsReducer, RecordedRouteReducer])],
            providers: [
                { provide: ResourcesService, useValue: {} },
                {
                    provide: ToastService, useValue: {
                        warning: jasmine.createSpy()
                    }
                },
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: TracesService, useValue: tracesServiceMock },
                { provide: RunningContextService, useValue: runnningContextServiceMock },
                {
                    provide: GeoLocationService, useValue: {
                        positionWhileInBackground: new EventEmitter(),
                        backToForeground: new EventEmitter()
                    }
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
            expect(service.isRecording()).toBeFalse();
        }
    ));

    it("Should return false for canRecord when in searching state", inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
            store.reset({
                gpsState: {
                    tracking: "searching"
                }
            });
            expect(service.canRecord()).toBeFalse();
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
                const spy = jasmine.createSpy();
                store.dispatch = spy;
                service.initialize();
                expect(spy.calls.all()[0].args[0]).toBeInstanceOf(StopRecordingAction);
                expect(spy.calls.all()[1].args[0]).toBeInstanceOf(AddRouteAction);
            }
        ));

    it("Should initialize after a recording stopped in the middle with pending proccessing location and stop the recording gracefully",
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
                                timestamp: new Date(0)
                            }
                            ]
                        },
                        pendingProcessing: [{
                            coords: {
                                latitude: 1,
                                longitude: 2
                            } as GeolocationCoordinates,
                            timestamp: new Date(1000).getTime()
                        } as GeolocationPosition]
                    },
                    routeEditingState: {
                        routingType: "Hike"
                    },
                    userState: {
                        userInfo: null
                    }
                });
                const spy = jasmine.createSpy();
                store.dispatch = spy;
                service.initialize();
                expect(spy.calls.all()[0].args[0]).toBeInstanceOf(ClearPendingProcessingRoutePointsAction);
                expect(spy.calls.all()[1].args[0]).toBeInstanceOf(AddRecordingRoutePointsAction);
                expect(spy.calls.all()[2].args[0]).toBeInstanceOf(StopRecordingAction);
                expect(spy.calls.all()[3].args[0]).toBeInstanceOf(AddRouteAction);
            }
        ));

    it("Should not do anything when not recording and a new position is received", inject([RecordedRouteService, Store],
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

            positionChanged(store, { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(1).getTime() } as GeolocationPosition);

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(0);
        }
    ));

    it("Should add a valid location when a position changes", inject([RecordedRouteService, Store],
        (service: RecordedRouteService, store: Store) => {
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
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                }
            });
            service.initialize();
            service.startRecording();
            positionChanged(store, { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(2).getTime() } as GeolocationPosition);

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(2);
        }
    ));

    it("Should add a valid locations when a new position arrives and other are recieved while in background", inject([RecordedRouteService, GeoLocationService, Store],
        (service: RecordedRouteService, geoService: GeoLocationService, store: Store) => {
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
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                },
            });
            service.initialize();
            service.startRecording();
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(60000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(120000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(180000).getTime() } as GeolocationPosition);

            positionChanged(store,
                { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(240000).getTime() } as GeolocationPosition
            );
            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(5);
        }
    ));

    it("Should not add the same location twice in case of a duplicate position due to how geolocation service works", inject([RecordedRouteService, GeoLocationService, LoggingService, Store],
        (service: RecordedRouteService, geoService: GeoLocationService,
            loggingService: LoggingService, store: Store) => {
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
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                },
            });
            service.initialize();
            service.startRecording();
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(60000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(120000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(180000).getTime() } as GeolocationPosition);
            const spy = spyOn(loggingService, "debug");
            positionChanged(store,
                { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(180000).getTime() } as GeolocationPosition
            );
            geoService.backToForeground.next();
            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(4);
            expect(spy.calls.all().some(c => c.args[0].startsWith("[Record] Rejecting position"))).toBeFalsy();
        }
    ));

    it("Should invalidate multiple locations once and update recoding when comming back to foregound", inject([RecordedRouteService, GeoLocationService, LoggingService, Store],
        (service: RecordedRouteService, geoService: GeoLocationService,
            loggingService: LoggingService, store: Store) => {
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
                            altitude: 10,
                        },
                        timestamp: new Date(0).getTime()
                    }
                },
            });
            service.initialize();
            const spy = spyOn(loggingService, "debug");
            service.startRecording();
            geoService.positionWhileInBackground.next({ coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(150000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(1000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(2000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(3000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { longitude: 1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(3000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { longitude: 1, latitude: 2, accuracy: 1000 } as GeolocationCoordinates, timestamp: new Date(4000).getTime() } as GeolocationPosition);
            geoService.positionWhileInBackground.next({ coords: { longitude: 1.1, latitude: 2 } as GeolocationCoordinates, timestamp: new Date(5000).getTime() } as GeolocationPosition);

            geoService.backToForeground.next();
            let i = 0;
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Processing 7")).toBeTruthy();
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Validating a rejected position")).toBeTruthy();
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(spy.calls.all()[i++].args[0].startsWith("[Record] Rejecting position for rejected")).toBeTruthy();

            expect(store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.latlngs.length).toBe(4);
        }));

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
                        markers: [{ description: "desc", title: "mock-marker" } as MarkerData]
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
            const spy = jasmine.createSpy();
            store.dispatch = spy;
            service.stopRecording();

            expect(spy.calls.all().some(c => c.args[0].trace &&
                c.args[0].trace.dataContainer.routes[0].markers.length > 0)).toBeTruthy();
        }));
});
