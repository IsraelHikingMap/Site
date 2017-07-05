import { TestBed, async, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { HttpModule, Http, Response, ResponseOptions, XHRBackend } from "@angular/http";
import { MockBackend, MockConnection } from "@angular/http/testing";
import { RouterService } from "./RouterService";
import { ResourcesService } from "../ResourcesService";
import { ToastService } from "../ToastService";
import { GeoJsonParser } from "../GeoJsonParser";
import { ToastServiceMockCreator } from "../toast.service.spec";

describe("RouterService", () => {
    beforeEach(() => {
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                { provide: XHRBackend, useClass: MockBackend },
                GeoJsonParser,
                RouterService,
            ]
        });
    });

    it("Should route between two points", inject([RouterService, XHRBackend], async(router: RouterService, mockBackend: MockBackend) => {
        mockBackend.connections.subscribe((connection: MockConnection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({
                    type: "FeatureCollection", features: [
                        {
                            type: "Feature",
                            properties: {
                                name: "name"
                            },
                            geometry: {
                                type: "LineString",
                                coordinates: [[1, 1] as GeoJSON.Position, [1.5, 1.5], [2, 2]]
                            } as GeoJSON.LineString
                        } as GeoJSON.Feature<GeoJSON.LineString>
                    ]
                } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>)
            })));
        });
            
        router.getRoute(L.latLng(1, 1), L.latLng(2, 2), "Hike").then((data) => {
            expect(data.length).toBe(2);
            expect(data[1].latlngs.length).toBe(3);
        });
    }));
    
    it("Should use none router when reponse is not a geojson", inject([RouterService, XHRBackend], async (router: RouterService, mockBackend: MockBackend) => {
        mockBackend.connections.subscribe((connection: MockConnection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({})
            })));
        });
        router.getRoute(L.latLng(1, 1), L.latLng(2, 2), "Hike").then((data) => {
            expect(data.length).toBe(1);
            expect(data[0].latlngs.length).toBe(2);
        });
    }));
    
    it("Should use none router when getting error response from server", inject([RouterService, XHRBackend], async (router: RouterService, mockBackend: MockBackend) => {
        mockBackend.connections.subscribe((connection: MockConnection) => {
            connection.mockError(new Error(""));
        });
        router.getRoute(L.latLng(1, 1), L.latLng(2, 2), "Hike").then((data) => {
            expect(data.length).toBe(1);
            expect(data[0].latlngs.length).toBe(2);
        });
    }));
});