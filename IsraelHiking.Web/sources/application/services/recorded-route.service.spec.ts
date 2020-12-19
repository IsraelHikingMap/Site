import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { TestBed, inject } from "@angular/core/testing";
import { NgReduxTestingModule } from "@angular-redux/store/testing";

import { RecordedRouteService } from "./recorded-route.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { GeoLocationService } from "./geo-location.service";
import { ResourcesService } from "./resources.service";
import { TracesService } from "./traces.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { RoutesFactory } from "./layers/routelayers/routes.factory";
import { LoggingService } from "./logging.service";
import { NgRedux } from "@angular-redux/store";
import { ApplicationState, RouteData } from "../models/models";
import { ToastService } from "./toast.service";
import { BackgroundGeolocation } from "@ionic-native/background-geolocation/ngx";
import { RunningContextService } from "./running-context.service";
import { ConnectionService } from "./connection.service";
import { Device } from "@ionic-native/device/ngx";

describe("RecordedRouteService", () => {
    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        // let geoLocationMock = {
        //    positionChanged: new EventEmitter(),
        //    bulkPositionChanged: new EventEmitter(),
        // }
        let loggingServiceMock = {
            debug: () => { }
        };
        let selectedRouteServiceMock = {
            getRecordingRoute: () => { }
        };
        TestBed.configureTestingModule({
            imports: [
                NgReduxTestingModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: ToastService, useValue: toastMock.toastService },
                // { provide: GeoLocationService, useValue: geoLocationMock },
                { provide: LoggingService, useValue: loggingServiceMock },
                { provide: SelectedRouteService, useValue: selectedRouteServiceMock },
                { provide: TracesService, useValue: null },
                GeoLocationService,
                BackgroundGeolocation,
                RunningContextService,
                ConnectionService,
                Device,
                RoutesFactory,
                RecordedRouteService
            ]
        });
    });

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
            geoService.positionChanged.next(
                {
                    coords: { latitude: 1, longitude: 2 } as Coordinates,
                    timestamp: new Date(1).getTime()
                });
            geoService.bulkPositionChanged.next([
                {
                    coords: { longitude: 1, latitude: 2 } as Coordinates,
                    timestamp: new Date(150000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as Coordinates,
                    timestamp: new Date(151000).getTime()
                },
                {
                    coords: { longitude: 1, latitude: 2 } as Coordinates,
                    timestamp: new Date(152000).getTime()
                }
            ]);

            expect(spy.calls.all()[0].args[0].startsWith("[Record] Valid position")).toBeTruthy(spy.calls.all()[0].args[0]);
            expect(spy.calls.all()[1].args[0].startsWith("[Record] Rejecting position,")).toBeTruthy(spy.calls.all()[1].args[0]);
            expect(spy.calls.all()[2].args[0].startsWith("[Record] Validating a rejected position")).toBeTruthy(spy.calls.all()[2].args[0]);
            expect(spy.calls.all()[3].args[0].startsWith("[Record] Valid position")).toBeTruthy(spy.calls.all()[3].args[0]);
        }));
});
