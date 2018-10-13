import { TestBed, inject, flushMicrotasks, fakeAsync, tick } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import * as L from "leaflet";

import { SnappingService, ISnappingRouteOptions } from "./snapping.service";
import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { MapServiceMockCreator } from "./map.service.spec";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { GeoJsonParser } from "./geojson.parser";

describe("SnappingService", () => {
    let mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: MapService, useValue: mapServiceMock.mapService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                GeoJsonParser,
                SnappingService
            ]
        });
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should not be enabled when enable is called with false", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(false);
        expect(snappingService.isEnabled()).toBe(false);
    }));

    it("Should return empty snappings when zoom is less than 14", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);

        mapServiceMock.mapService.map.setZoom(12); // this fires moveend

        let snap = snappingService.snapToRoute(LatLngAlt(0, 0));
        expect(snap.polyline).toBeNull();
    }));

    it("Should add one snappings linestring when zoom is 14", inject([SnappingService, HttpTestingController],
        fakeAsync((snappingService: SnappingService, mockBackend: HttpTestingController) => {

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

        mapServiceMock.mapService.map.setView(LatLngAlt(0, 0), 14);
        flushMicrotasks();
        mockBackend.match(() => true)[0].flush(features);
        tick();

        let snap = snappingService.snapToRoute(LatLngAlt(2, 1));
        expect(snap.polyline).not.toBeNull();
    })));

    it("Should add one snappings polygon when zoom is 14", fakeAsync(inject([SnappingService, HttpTestingController],
        (snappingService: SnappingService, mockBackend: HttpTestingController) => {

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

        mapServiceMock.mapService.map.setView(LatLngAlt(1, 1), 14);
        flushMicrotasks();
        mockBackend.match(() => true)[0].flush(features);
        tick();

        let snap = snappingService.snapToRoute(LatLngAlt(2, 1));
        expect(snap.polyline).not.toBeNull();
    })));

    it("Should add one snappings point when zoom is 14", inject([SnappingService, HttpTestingController],
        fakeAsync((snappingService: SnappingService, mockBackend: HttpTestingController) => {

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

        mapServiceMock.mapService.map.setView(LatLngAlt(0, 0), 14);
        flushMicrotasks();
        mockBackend.match(() => true)[0].flush(features);
        tick();

        let snap = snappingService.snapToPoint(LatLngAlt(2, 1));
        expect(snap.markerData).not.toBeNull();
    })));

    it("Should clear layer upon http error", fakeAsync(inject([SnappingService, HttpTestingController],
        (snappingService: SnappingService, mockBackend: HttpTestingController) => {

        snappingService.enable(true);

        mapServiceMock.mapService.map.setView(LatLngAlt(2, 2), 14);
        flushMicrotasks();
        tick();
        mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });

        let snap = snappingService.snapToRoute(LatLngAlt(0, 0));
        expect(snap.polyline).toBeNull();
    })));


    it("Should snap to its own layers", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);
        let polylines = [L.polyline([LatLngAlt(1, 1), LatLngAlt(1, 2)])];

        let snap = snappingService.snapToRoute(LatLngAlt(1.00001, 1),
            {
                polylines: polylines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should snap to closest point", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);
        let polylines = [L.polyline([LatLngAlt(1, 1), LatLngAlt(1, 1.00001), LatLngAlt(1, 2)])];

        let snap = snappingService.snapToRoute(LatLngAlt(1, 1.0001),
            {
                polylines: polylines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.latlng.lng).toBeGreaterThan(1.0);
    }));

    it("Should snap to its own layers but ignore a line with single point",
        inject([SnappingService], (snappingService: SnappingService) => {

        snappingService.enable(true);
        let polylines = [L.polyline([LatLngAlt(1, 1)]), L.polyline([LatLngAlt(1, 1), LatLngAlt(1, 2)])];

        let snap = snappingService.snapToRoute(LatLngAlt(1.00001, 1),
            {
                polylines: polylines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should snap to a given layer", inject([SnappingService], (snappingService: SnappingService) => {
        let polylines = [L.polyline([LatLngAlt(1, 1), LatLngAlt(1, 2)])];

        let snap = snappingService.snapToRoute(LatLngAlt(1.01, 1),
            {
                polylines: polylines,
                sensitivity: 1000
            } as ISnappingRouteOptions);

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should not snap when there are no layers", inject([SnappingService], (snappingService: SnappingService) => {
        let snap = snappingService.snapToRoute(LatLngAlt(10, 10));

        expect(snap.polyline).toBeNull();
    }));

    it("Should not snap when point is too far", inject([SnappingService], (snappingService: SnappingService) => {
        let polylines = [L.polyline([LatLngAlt(1, 1), LatLngAlt(2, 2)])];

        let snap = snappingService.snapToRoute(LatLngAlt(10, 10),
            {
                polylines: polylines,
                sensitivity: 10
            } as ISnappingRouteOptions);

        expect(snap.polyline).toBeNull();
    }));
});