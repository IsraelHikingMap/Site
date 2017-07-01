import { TestBed, async, inject, flushMicrotasks, fakeAsync } from "@angular/core/testing";
import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { MockBackend, MockConnection } from "@angular/http/testing";
import { SnappingService, ISnappingOptions } from "./SnappingService";
import { MapService } from "./MapService";
import { ResourcesService } from "./ResourcesService";
import { ToastService } from "./ToastService";
import { MapServiceMockCreator } from "./map.service.spec";
import { ToastServiceMockCreator } from "./toast.service.spec";

describe("SnappingService", () => {
    var snappingService: SnappingService;
    var mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: ResourcesService, useValue: mapServiceMock.resourcesService },
                { provide: XHRBackend, useClass: MockBackend },
                { provide: MapService, useValue: mapServiceMock.mapService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                SnappingService
            ]
        });
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should clear snappings layer when disabled", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(false);
        mapServiceMock.mapService.map.setZoom(14); // this fires moveend

        expect(snappingService.snappings.getLayers().length).toBe(0);
        expect(snappingService.isEnabled()).toBe(false);
    }));

    it("Should clear snappings layer when zoom is less than 14", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);

        mapServiceMock.mapService.map.setZoom(12); // this fires moveend

        expect(snappingService.snappings.getLayers().length).toBe(0);
    }));

    it("Should add one snappings linestring when zoom is 14", inject([SnappingService, XHRBackend], fakeAsync((snappingService: SnappingService, mockBackend: MockBackend) => {
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

        mockBackend.connections.subscribe((connection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify(features)
            })));
        });

        mapServiceMock.mapService.map.setView(L.latLng(0, 0), 14);
        flushMicrotasks();
        
        expect(snappingService.snappings.getLayers().length).toBe(1);
    })));

    it("Should add one snappings polygon when zoom is 14", fakeAsync(inject([SnappingService, XHRBackend], (snappingService: SnappingService, mockBackend: MockBackend) => {
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

        mockBackend.connections.subscribe((connection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify(features)
            })));
        });

        mapServiceMock.mapService.map.setView(L.latLng(1, 1), 14);
        flushMicrotasks();

        expect(snappingService.snappings.getLayers().length).toBe(1);
    })));

    it("Should clear layer upon http error", fakeAsync(inject([SnappingService, XHRBackend], (snappingService: SnappingService, mockBackend: MockBackend) => {
        snappingService.enable(true);

        snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(2, 2)]));
        expect(snappingService.snappings.getLayers().length).toBe(1);

        mockBackend.connections.subscribe((connection: MockConnection) => {
            connection.mockError(new Error("Server error"));
        });

        mapServiceMock.mapService.map.setView(L.latLng(2, 2), 14);
        flushMicrotasks();

        expect(snappingService.snappings.getLayers().length).toBe(0);
    })));


    it("Should snap to its own layers", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);
        snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 2)]));

        let snap = snappingService.snapTo(L.latLng(1.00001, 1));

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should snap to closest point", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);
        snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 1.00001), L.latLng(1, 2)]));

        let snap = snappingService.snapTo(L.latLng(1, 1.0001));

        expect(snap.latlng.lng).toBeGreaterThan(1.0);
    }));

    it("Should snap to its own layers but ignore a line with single point", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.enable(true);
        snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1)]));
        snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 2)]));

        let snap = snappingService.snapTo(L.latLng(1.00001, 1));

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should snap to a given layer", inject([SnappingService], (snappingService: SnappingService) => {
        let layers = L.layerGroup([]);
        layers.addLayer(L.polyline([L.latLng(1, 1), L.latLng(1, 2)]));

        let snap = snappingService.snapTo(L.latLng(1.01, 1), { layers: layers, sensitivity: 1000 } as ISnappingOptions);

        expect(snap.latlng.lat).toBe(1.0);
        expect(snap.latlng.lng).toBe(1.0);
    }));

    it("Should not snap when there are no layers", inject([SnappingService], (snappingService: SnappingService) => {
        let snap = snappingService.snapTo(L.latLng(10, 10));

        expect(snap.polyline).toBeNull();
    }));

    it("Should not snap when point is too far", inject([SnappingService], (snappingService: SnappingService) => {
        snappingService.snappings.addLayer(L.polyline([L.latLng(1, 1), L.latLng(2, 2)]));

        let snap = snappingService.snapTo(L.latLng(10, 10));

        expect(snap.polyline).toBeNull();
    }));
});