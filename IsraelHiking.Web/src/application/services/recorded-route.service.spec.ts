import { HttpClientTestingModule } from "@angular/common/http/testing";
import { TestBed, inject } from "@angular/core/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";

import { RecordedRouteService } from "./recorded-route.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { GeoLocationService } from "./geo-location.service";
import { ResourcesService } from "./resources.service";
import { TracesService } from "./traces.service";
import { SelectedRouteService } from "./selected-route.service";
import { RoutesFactory } from "./routes.factory";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { RunningContextService } from "./running-context.service";
import { ConnectionService } from "./connection.service";
import { AddRecordingPointsAction } from "../reducers/routes.reducer";
import type { ApplicationState, RouteData } from "../models/models";

import { getSubject } from "./selected-route-service.spec";

describe("Recorded Route Service", () => {
    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let loggingServiceMock = {
            debug: () => { },
            info: () => { }
        };
        let selectedRouteServiceMock = {
            getRecordingRoute: () => { }
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
                { provide: SelectedRouteService, useValue: selectedRouteServiceMock },
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

    it("Should add a valid location", done =>
        inject([RecordedRouteService, SelectedRouteService],
        (service: RecordedRouteService, selectedRouteService: SelectedRouteService) => {
            service.initialize();
            let recordingRoute = {
                id: "1",
                name: "",
                description: "",
                markers: [],
                segments: [{
                    routePoint: {
                        lat: 1,
                        lng: 2,
                        alt: 10
                    },
                    routingType: "Hike",
                    latlngs: [{
                        lat: 1,
                        lng: 2,
                        alt: 10,
                        timestamp: new Date(0)
                    }]
                }]
            } as RouteData;
            MockNgRedux.store.getState = () => ({
                userState: {}
            });
            selectedRouteService.getRecordingRoute = () => recordingRoute;
            const positionStub = getSubject((state: ApplicationState) => state.gpsState.currentPoistion);
            let spy = jasmine.createSpy();
            MockNgRedux.store.dispatch = spy;

            positionStub.next(
                { coords: { latitude: 1, longitude: 2 } as GeolocationCoordinates, timestamp: new Date(1).getTime()}
            );
            setTimeout(() => {
                expect(spy.calls.all().length).toBe(1);
                expect((spy.calls.all()[0].args[0] as AddRecordingPointsAction).payload.latlngs.length).toBe(1);
                done();
            }, 10);
        }
    )());

    it("Should invalidate multiple locations once", inject([RecordedRouteService, GeoLocationService,
        LoggingService, SelectedRouteService],
        (service: RecordedRouteService, geoService: GeoLocationService,
         logginService: LoggingService, selectedRouteService: SelectedRouteService) => {
            service.initialize();
            let recordingRoute = {
                id: "1",
                name: "",
                description: "",
                markers: [],
                segments: [{
                    routePoint: {
                        lat: 1,
                        lng: 2,
                        alt: 10
                    },
                    routingType: "Hike",
                    latlngs: [{
                        lat: 1,
                        lng: 2,
                        alt: 10,
                        timestamp: new Date(0)
                    }]
                }]
            } as RouteData;
            selectedRouteService.getRecordingRoute = () => recordingRoute;
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
});
