import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { OverpassTurboService } from "./overpass-turbo.service";
import { Urls } from "../urls";

describe("OverpassTurboService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                OverpassTurboService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get a feature by id and convert it to a line", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response = {
            elements: [{
                id: 1,
                type: "node",
                lat: 1,
                lon: 2,
            }, {
                id: 2,
                type: "node",
                lat: 3,
                lon: 4,
            }, {
                id: 3,
                type: "way",
                nodes: [1,2]
            }]
        };
        const promise = service.getFeature("way", "42");
        mockBackend.expectOne(r => r.url.startsWith(Urls.osmApi)).flush(response);
        const results = await promise;
        expect(results.geometry.type).toBe("LineString");
    }));

    it("Should get a relation feature by id and convert it to a line", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response = {
            elements: [{
                type: "relation",
                id: 1,
                members: [{
                    type: "way",
                    ref: 2,
                    geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]
                }, {
                    type: "way",
                    ref: 3,
                    geometry: [
                        {lat: 1, lon: 2}, {lat: 31.5954429, lon: 34.5619778},{lat: 31.5954049, lon: 34.5618109}, {lat: 1, lon: 2}
                    ]
                }, {
                    type: "way",
                    ref: 4,
                    geometry: [{lat: 5, lon: 6}, {lat: 1, lon: 2}]
                }, {
                    type: "way",
                    ref: 5,
                    geometry: [{lat: 3, lon: 4}, {lat: 7, lon: 8}]
                }, {
                    type: "way",
                    ref: 6,
                    geometry: [
                        {lat: 7, lon: 8}, {lat: 31.5979193, lon: 34.5545826}, {lat: 31.5978981, lon: 34.5542436}, {lat: 7, lon: 8}
                    ]
                }, {
                    type: "way",
                    ref: 7,
                    geometry: [{lat: 31.6001179, lon: 34.5571696}, {lat: 5, lon: 6}]
                }]
            }]
        };
        const promise = service.getFeature("way", "42");
        mockBackend.expectOne(r => r.url.startsWith(Urls.osmApi)).flush(response);
        const results = await promise;
        expect(results.geometry.type).toBe("LineString");
    }));

    it("Should get a relation feature by id with multiple roles and convert it to a line", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response = {
            elements: [{
                type: "relation",
                id: 1,
                members: [{
                    role: "forward",
                    type: "way",
                    ref: 2,
                    geometry: [{lat: 3, lon: 4}, {lat: 5, lon: 6}]
                }, {
                    role: "backward",
                    type: "way",
                    ref: 3,
                    geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]
                }, {
                    role: "backward",
                    type: "way",
                    ref: 4,
                    geometry: [{lat: 5, lon: 6}, {lat: 7, lon: 8}]
                }]
            }]
        };
        const promise = service.getFeature("way", "42");
        mockBackend.expectOne(r => r.url.startsWith(Urls.osmApi)).flush(response);
        const results = await promise;
        expect(results.geometry.type).toBe("LineString");
    }));

    it("Should get a long way with multiple ways and merge them", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response = {
            elements: [{
                id: 1,
                type: "node",
                lat: 1,
                lon: 2,
            }, {
                id: 2,
                type: "node",
                lat: 3,
                lon: 4,
            }, {
                id: 3,
                type: "node",
                lat: 4,
                lon: 5,
            }, {
                id: 4,
                type: "way",
                nodes: [1, 2]
            }, {
                id: 5,
                type: "way",
                nodes: [2, 3]
            }]
        };

        const promise = service.getLongWay("id", "name", false, false);
        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);

        const results = await promise;
        expect(results.geometry.type).toBe("LineString");
    }));

    it("Should get a long way with multiple geometries and return the first feature", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response = {
            elements: [{
                id: 1,
                type: "node",
                lat: 1,
                lon: 2,
            }, {
                id: 2,
                type: "node",
                lat: 3,
                lon: 4,
            }, {
                id: 3,
                type: "node",
                lat: 4,
                lon: 5,
            }, {
                id: 4,
                type: "way",
                tags: { waterway: "dock"},
                nodes: [1, 2, 3, 1]
            }, {
                id: 5,
                type: "way",
                nodes: [1, 2]
            }, ]
        };
        const promise = service.getLongWay("id", "name", false, false);
        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);

        const results = await promise;
        expect(results.geometry.type).toBe("Polygon");
    }));

    it("Should get a long way by name", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "name", false, false);

        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeUndefined();
    }));

    it("Should get a long mtb way by name", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "aaa", false, true);

        mockBackend.expectOne(u => u.body.includes("mtb:name")).flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeUndefined();
    }));

    it("Should get a long waterway way by name", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "aaa", true, false);

        mockBackend.expectOne(u => u.body.includes("waterway")).flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeUndefined();
    }));

    it("Should get a long way by name with '\"'", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "lalala\"", false, false);

        mockBackend.expectOne(u => u.body.includes("lalala\\\"")).flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeUndefined();
    }));


    it("Should get a place by id", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getPlaceGeometry("42");

        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeUndefined();
    }));

    it("Should handle super relations", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response1 = {
            elements: [{
                type: "relation",
                id: 2,
                members: [{
                    type: "way",
                    ref: 3,
                }]
            }, {
                type: "relation",
                id: 1,
                members: [{
                    type: "relation",
                    ref: 2,
                }]
            }]
        };
        const response2 = {
            elements: [{
                type: "relation",
                id: 2,
                members: [{
                    type: "way",
                    ref: 3,
                }]
            }, {
                type: "way",
                id: 3,
                nodes: [1, 2],
                geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]
            }
        ]
        };
        const promise = service.getFeature("relation", "1");
        mockBackend.expectOne(r => r.url === Urls.osmApi + "relation/1/full.json").flush(response1);
        await new Promise(resolve => setTimeout(resolve, 10));
        mockBackend.expectOne(r => r.url === Urls.osmApi + "relation/2/full.json").flush(response2);
        const results = await promise;
        expect(results.geometry.type).toBe("LineString");
    }));

    it("Should handle circular relations", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        const response1 = {
            elements: [{
                type: "relation",
                id: 1,
                members: [{
                    type: "relation",
                    ref: 2,
                }]
            },{
                type: "relation",
                id: 2,
                members: [{
                    type: "relation",
                    ref: 1,
                },{
                    type: "way",
                    ref: 3,
                }]
            }]
        };
        const response2 = {
            elements: [{
                type: "relation",
                id: 2,
                members: [{
                    type: "way",
                    ref: 3,
                }]
            }, {
                type: "way",
                id: 3,
                nodes: [1, 2],
                geometry: [{lat: 1, lon: 2}, {lat: 3, lon: 4}]
            }]
        };
        const promise = service.getFeature("relation", "1");
        mockBackend.expectOne(r => r.url === Urls.osmApi + "relation/1/full.json").flush(response1);
        await new Promise(resolve => setTimeout(resolve, 10));
        mockBackend.expectOne(r => r.url === Urls.osmApi + "relation/2/full.json").flush(response2);
        const results = await promise;
        expect(results).toBeUndefined();
    }));
});




