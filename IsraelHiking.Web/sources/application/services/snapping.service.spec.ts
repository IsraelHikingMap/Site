import { TestBed, inject, flushMicrotasks, fakeAsync, tick } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { View } from "ol";

import { SnappingService, ISnappingRouteOptions } from "./snapping.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { GeoJsonParser } from "./geojson.parser";

describe("SnappingService", () => {

    let mapMock: any;
    let moveEndAction: Function;
    let view: View;

    beforeEach(() => {
        let toastMockCreator = new ToastServiceMockCreator();
        view = new View();
        view.setCenter([0, 0]);
        view.setResolution(1);
        mapMock = {
            on: (event, method) => moveEndAction = method,
            getView: () => view,
            getPixelFromCoordinate: (x) => x,
            getSize: () => [1000, 1000]
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                GeoJsonParser,
                SnappingService
            ]
        });
    });

    it("Should not be enabled when enable is called with false", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(false);
        expect(snappingService.isEnabled()).toBe(false);
    }));

    it("Should return empty snappings when zoom is less than 14", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.setMap(mapMock);
        snappingService.enable(true);
        moveEndAction(); // this fires moveend

        let snap = snappingService.snapToRoute({ lat: 0, lng: 0 });
        expect(snap.line).toBeNull();
    }));

    it("Should add one snappings linestring when zoom is 14", inject([SnappingService, HttpTestingController],
        fakeAsync((snappingService: SnappingService, mockBackend: HttpTestingController) => {

            view.setZoom(14);
            view.setCenter([0, 0]);
            snappingService.setMap(mapMock);
            snappingService.enable(true);

            let features = [
                {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[1, 2], [3, 4]]
                    } as GeoJSON.LineString
                } as GeoJSON.Feature<GeoJSON.LineString>
            ];

            flushMicrotasks();
            mockBackend.match(() => true)[0].flush(features);
            tick();

            let snap = snappingService.snapToRoute({ lat: 2, lng: 1 });
            expect(snap.line).not.toBeNull();
        })));

    it("Should add one snappings polygon when zoom is 14", fakeAsync(inject([SnappingService, HttpTestingController],
        (snappingService: SnappingService, mockBackend: HttpTestingController) => {

            view.setZoom(14);
            view.setCenter([1, 1]);
            snappingService.setMap(mapMock);
            snappingService.enable(true);

            let features = [
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[[1, 2], [3, 4], [5, 6], [1, 2]]]
                    } as GeoJSON.Polygon
                } as GeoJSON.Feature<GeoJSON.Polygon>
            ];

            flushMicrotasks();
            mockBackend.match(() => true)[0].flush(features);
            tick();

            let snap = snappingService.snapToRoute({ lat: 2, lng: 1 });
            expect(snap.line).not.toBeNull();
        })));

    it("Should add one snappings point when zoom is 14", inject([SnappingService, HttpTestingController],
        fakeAsync((snappingService: SnappingService, mockBackend: HttpTestingController) => {

            view.setZoom(14);
            view.setCenter([0, 0]);
            snappingService.setMap(mapMock);
            snappingService.enable(true);

            let features = [
                {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Point",
                        coordinates: [1, 2]
                    } as GeoJSON.Point
                } as GeoJSON.Feature<GeoJSON.Point>
            ];

            flushMicrotasks();
            mockBackend.match(() => true)[0].flush(features);
            tick();

            let snap = snappingService.snapToPoint({ lat: 2, lng: 1 });
            expect(snap.markerData).not.toBeNull();
        })));

    it("Should clear layer upon http error", fakeAsync(inject([SnappingService, HttpTestingController],
        (snappingService: SnappingService, mockBackend: HttpTestingController) => {

            view.setZoom(14);
            view.setCenter([2, 2]);
            snappingService.setMap(mapMock);
            snappingService.enable(true);

            flushMicrotasks();
            tick();
            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });

            let snap = snappingService.snapToRoute({ lat: 0, lng: 0 });
            expect(snap.line).toBeNull();
        })));


    it("Should snap to its own layers", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.setMap(mapMock);
        snappingService.enable(true);
        let lines = [[{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }]];

        let snap = snappingService.snapToRoute({ lat: 1.00001, lng: 1 },
            {
                lines: lines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should snap to closest point", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.setMap(mapMock);
        snappingService.enable(true);
        let lines = [[{ lat: 1, lng: 1 }, { lat: 1, lng: 1.00001 }, { lat: 1, lng: 2 }]];

        let snap = snappingService.snapToRoute({ lat: 1, lng: 1.0001 },
            {
                lines: lines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.latlng.lng).toBeGreaterThan(1.0);
    }));

    it("Should snap to its own layers but ignore a line with single point",
        inject([SnappingService], (snappingService: SnappingService) => {
            snappingService.setMap(mapMock);
            snappingService.enable(true);
            let lines = [[{ lat: 1, lng: 1 }], [{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }]];

            let snap = snappingService.snapToRoute({ lat: 1.00001, lng: 1 },
                {
                    lines: lines,
                    sensitivity: 10
                } as ISnappingRouteOptions);

            expect(snap.latlng.lat).toBe(1.0);
            expect(snap.latlng.lng).toBe(1.0);
        }));

    it("Should snap to a given layer", inject([SnappingService], (snappingService: SnappingService) => {
        let lines = [[{ lat: 1, lng: 1 }, { lat: 1, lng: 2 }]];
        snappingService.setMap(mapMock);

        let snap = snappingService.snapToRoute({ lat: 1.01, lng: 1 },
            {
                lines: lines,
                sensitivity: 2000
            } as ISnappingRouteOptions);

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should not snap when there are no layers", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.setMap(mapMock);

        let snap = snappingService.snapToRoute({ lat: 10, lng: 10 });

        expect(snap.line).toBeNull();
    }));

    it("Should not snap when point is too far", inject([SnappingService], (snappingService: SnappingService) => {
        let lines = [[{ lat: 1, lng: 1 }, { lat: 2, lng: 2 }]];
        snappingService.setMap(mapMock);

        let snap = snappingService.snapToRoute({ lat: 10, lng: 10 },
            {
                lines: lines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.line).toBeNull();
    }));
});