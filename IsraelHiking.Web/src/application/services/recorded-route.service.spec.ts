import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed, inject } from "@angular/core/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";

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
import { AddRecordingRoutePointsAction } from "../reducers/recorded-route.reducer";
import type { ApplicationState, MarkerData } from "../models/models";

import { getSubject } from "./selected-route-service.spec";

describe("Recorded Route Service", () => {
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
                MockNgReduxModule,
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
        MockNgRedux.reset();
    });

    it("Should add a valid location", done => inject([RecordedRouteService],
        (service: RecordedRouteService) => {
            MockNgRedux.store.getState = () => ({
                recordedRouteState: {
                    isRecording: false
                }
            });
            service.initialize();
            MockNgRedux.store.getState = () => ({
                userState: {},
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
            const positionStub = getSubject((state: ApplicationState) => state.gpsState.currentPoistion);
            let spy = jasmine.createSpy();
            MockNgRedux.store.dispatch = spy;

            positionStub.next(
                { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(1).getTime()}
            );
            setTimeout(() => {
                expect(spy.calls.all().length).toBe(1);
                expect((spy.calls.all()[0].args[0] as AddRecordingRoutePointsAction).payload.latlngs.length).toBe(1);
                done();
            }, 10);
        }
    )());

    it("Should invalidate multiple locations once", inject([RecordedRouteService, GeoLocationService, LoggingService],
        (service: RecordedRouteService, geoService: GeoLocationService,
         logginService: LoggingService) => {
            MockNgRedux.store.getState = () => ({
                recordedRouteState: {
                    isRecording: false
                }
            });
            service.initialize();
            MockNgRedux.store.getState = () => ({
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
            let spy = spyOn(logginService, "debug");

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
                }
            ]);

            expect(spy.calls.all()[0].args[0].startsWith("[Record] Valid position")).toBeTruthy();
            expect(spy.calls.all()[1].args[0].startsWith("[Record] Rejecting position,")).toBeTruthy();
            expect(spy.calls.all()[2].args[0].startsWith("[Record] Validating a rejected position")).toBeTruthy();
            expect(spy.calls.all()[3].args[0].startsWith("[Record] Valid position")).toBeTruthy();
        }));

    it("should stop recording and send data to traces upload mechanism including one marker", inject([RecordedRouteService], (service: RecordedRouteService) => {
        MockNgRedux.store.getState = () => ({
            recordedRouteState: {
                isRecording: false
            }
        });
        service.initialize();
        MockNgRedux.store.getState = () => ({
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
        MockNgRedux.store.dispatch = spy;
        service.stopRecording();

        expect(spy.calls.all().some(c => c.args[0].payload?.trace && c.args[0].payload.trace.dataContainer.routes[0].markers.length > 0)).toBeTruthy();
    }));
});
