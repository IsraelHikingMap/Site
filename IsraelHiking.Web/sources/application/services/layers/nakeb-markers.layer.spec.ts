import { Injector, ComponentFactoryResolver } from "@angular/core";
import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { MockBackend, MockConnection, } from "@angular/http/testing";
import { NakebMarkerLayer } from "./nakeb-markers.layer";
import { MapServiceMockCreator } from "../map.service.spec";
import { ResourcesService } from "../resources.service";
import { MapService } from "../map.service";

describe("NakebMarkerLayer", () => {
    var mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        let componentRefMock = {
            instance: {
                setMarker: () => { },
                angularBinding: () => { }
            }
        };
        let factory = {
            create: () => { return componentRefMock }
        };
        var componentFactoryResolver = {
            resolveComponentFactory: () => { return factory }
        };
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: MapService, useValue: mapServiceMock.mapService },
                { provide: ResourcesService, useValue: mapServiceMock.resourcesService },
                { provide: XHRBackend, useClass: MockBackend },
                NakebMarkerLayer,
                Injector,
                { provide: ComponentFactoryResolver, useValue: componentFactoryResolver }
            ]
        });
        (mapServiceMock.mapService.map as any)._layersMaxZoom = 19; // workaround for markercluster issue - removing this line will make the tests freeze.
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should fetch markers when initialized", inject([XHRBackend, Http, MapService, Injector, ComponentFactoryResolver],
        fakeAsync((mockBackend: MockBackend, http: Http, mapService: MapService, injector: Injector, componentFactoryResolver: ComponentFactoryResolver) => {
            let wasCalled = false;
            mockBackend.connections.subscribe((connection: MockConnection) => {
                wasCalled = true;
                connection.mockRespond(new Response(new ResponseOptions({
                    body: JSON.stringify([
                        {
                            id: 1,
                            start: { lat: "32", lng: "35" }
                        }
                    ])
                })));
            });

            let nakebLayer = new NakebMarkerLayer(mapService, http, injector, componentFactoryResolver);

            flushMicrotasks();
            expect(nakebLayer).not.toBeNull();
            expect(wasCalled).toBeTruthy();
        })));

    it("Should run on add when adding to map", inject([NakebMarkerLayer], (nakebLayer: NakebMarkerLayer) => {
        spyOn(nakebLayer, "onAdd");

        mapServiceMock.mapService.map.addLayer(nakebLayer);

        expect(nakebLayer.onAdd).toHaveBeenCalled();
    }));

    it("Should run on remove when removing from map", inject([NakebMarkerLayer], (nakebLayer: NakebMarkerLayer) => {
        spyOn(nakebLayer, "onRemove");

        mapServiceMock.mapService.map.addLayer(nakebLayer);
        mapServiceMock.mapService.map.removeLayer(nakebLayer);

        expect(nakebLayer.onRemove).toHaveBeenCalled();
    }));

    it("Should update markers when moving map", inject([XHRBackend, Http, MapService, Injector, ComponentFactoryResolver],
        fakeAsync((mockBackend: MockBackend, http: Http, mapService: MapService, injector: Injector, componentFactoryResolver: ComponentFactoryResolver) => {
            mockBackend.connections.subscribe((connection: MockConnection) => {
                connection.mockRespond(new Response(new ResponseOptions({
                    body: JSON.stringify([
                        {
                            id: 1,
                            start: { lat: "32", lng: "35" }
                        }
                    ])
                })));
            });
            let nakebLayer = new NakebMarkerLayer(mapService, http, injector, componentFactoryResolver);
            flushMicrotasks();
            mapServiceMock.mapService.map.addLayer(nakebLayer);
            let numberOflayersBefore = mapServiceMock.getNumberOfLayers();
            mapServiceMock.mapService.map.setView(L.latLng(32, 35), 15);

            expect(mapServiceMock.getNumberOfLayers()).toBeGreaterThan(numberOflayersBefore);
        })));
});