import { Injector, ComponentFactoryResolver } from "@angular/core";
import { JsonpModule, Response, ResponseOptions, JSONPBackend } from "@angular/http";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { MockBackend, MockConnection, } from "@angular/http/testing";
import * as L from "leaflet";

import { WikiMarkersLayer, IGeoSearchWikiPage, IGeoSearchWikiQuery, IGeoSearchWikiResponse } from "./wiki-markers.layer";
import { MapServiceMockCreator } from "../map.service.spec";
import { ResourcesService } from "../resources.service";
import { MapService } from "../map.service";

describe("WikiMarkerLayer", () => {
    var mapServiceMock: MapServiceMockCreator;

    beforeEach(() => {
        mapServiceMock = new MapServiceMockCreator();
        let componentRefMock = {
            instance: {
                setMarker: () => { },
                angularBinding: () => {}
            }
        };
        let factory = {
            create: () => { return componentRefMock }
        };
        var componentFactoryResolver = {
            resolveComponentFactory: () => { return factory }
        };

        TestBed.configureTestingModule({
            imports: [JsonpModule],
            providers: [
                { provide: MapService, useValue: mapServiceMock.mapService },
                { provide: ResourcesService, useValue: mapServiceMock.resourcesService },
                { provide: JSONPBackend, useClass: MockBackend },
                WikiMarkersLayer,
                Injector,
                { provide: ComponentFactoryResolver, useValue: componentFactoryResolver }
            ]
        });

        (mapServiceMock.mapService.map as any)._layersMaxZoom = 19; // workaround for markercluster issue - removing this line will make the tests freeze.
    });

    afterEach(() => {
        mapServiceMock.destructor();
    });

    it("Should run on add when adding to map", inject([WikiMarkersLayer], (wikiLayer: WikiMarkersLayer) => {
        spyOn(wikiLayer, "onAdd");

        mapServiceMock.mapService.map.addLayer(wikiLayer);

        expect(wikiLayer.onAdd).toHaveBeenCalled();
    }));

    it("Should run on remove when removing from map", inject([WikiMarkersLayer], (wikiLayer: WikiMarkersLayer) => {
        spyOn(wikiLayer, "onRemove");

        mapServiceMock.mapService.map.addLayer(wikiLayer);
        mapServiceMock.mapService.map.removeLayer(wikiLayer);

        expect(wikiLayer.onRemove).toHaveBeenCalled();
    }));

    it("Should get attribution", inject([WikiMarkersLayer], (wikiLayer: WikiMarkersLayer) => {
        expect(wikiLayer.getAttribution()).not.toBe("");
    }));

    it("Should get wiki markers when zoom is above 12 on map move in hebrew", inject([WikiMarkersLayer, JSONPBackend], fakeAsync((wikiLayer: WikiMarkersLayer, mockBackend: MockBackend) => {
        let wasCalled = false;
        mockBackend.connections.subscribe((connection: MockConnection) => {
            wasCalled = true;
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({
                    query: {
                        geosearch: [
                            {
                                pageid: 1,
                                title: "title",
                                lat: 0,
                                lon: 0
                            } as IGeoSearchWikiPage
                        ] as IGeoSearchWikiPage[]
                    } as IGeoSearchWikiQuery
                } as IGeoSearchWikiResponse)
            })));
        });
        mapServiceMock.mapService.map.setView(L.latLng(0, 0), 15);
        mapServiceMock.mapService.map.addLayer(wikiLayer);

        flushMicrotasks();
        expect(wasCalled).toBeTruthy();
    })));
});