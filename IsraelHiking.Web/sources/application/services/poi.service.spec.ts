import { TestBed, inject, async } from "@angular/core/testing";
import { HttpModule, Response, ResponseOptions, XHRBackend, RequestMethod } from "@angular/http";
import { MockBackend, MockConnection } from "@angular/http/testing";
import * as L from "leaflet";

import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { AuthorizationService } from "./authorization.service";
import { PoiService, IPointOfInterestExtended, IRating } from "./poi.service";

describe("Poi Service", () => {

    let checkHttpRequest = (mockBackend: MockBackend, validate: Function) => {
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (!validate(connection.request)) {
                fail();
            }
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({})
            })));
        });
    }

    beforeEach(() => {
        var toastMock = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: XHRBackend, useClass: MockBackend },
                AuthorizationService,
                PoiService
            ]
        });
    });

    it("Should get categories from server", async(inject([PoiService, XHRBackend], (poiService: PoiService, mockBackend: MockBackend) => {
        mockBackend.connections.subscribe((connection: MockConnection) => {
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify({
                    "category": [{ icon: "icon", category: "category"}],
                })
            })));
        });

        return poiService.getCategories("Points of Interest").then((resutls) => {
            expect(resutls).not.toBeNull();
            expect(resutls["category"].length).toBe(1);
        });
    })));

    it("Should get available categories types", (inject([PoiService], (poiService: PoiService) => {
        expect(poiService.getCategoriesTypes().length).toBe(2);
    })));

    it("Should get points from server", async(inject([PoiService, XHRBackend], (poiService: PoiService, mockBackend: MockBackend) => {
        let northEast = L.latLng(1, 2);
        let southWest = L.latLng(3, 4);
        checkHttpRequest(mockBackend,
            (request) => {
                return request.url.indexOf(northEast.lat + "," + northEast.lng) !== -1 &&
                    request.url.indexOf(southWest.lat + "," + southWest.lng) !== -1;
            });

        return poiService.getPoints(northEast, southWest, []);
    })));

    it("Should get a point by id and source from the server", async(inject([PoiService, XHRBackend], (poiService: PoiService, mockBackend: MockBackend) => {
        let id = "42";
        let source = "source";
        checkHttpRequest(mockBackend,
            (request) => {
                return request.url.indexOf(id) !== -1 &&
                    request.url.indexOf(source) !== -1;
            });

        return poiService.getPoint(id, source);
    })));

    it("Should update point using the server", async(inject([PoiService, XHRBackend], (poiService: PoiService, mockBackend: MockBackend) => {
        checkHttpRequest(mockBackend,
            (request) => {
                return request.method === RequestMethod.Post;
            });

        return poiService.uploadPoint({} as IPointOfInterestExtended);
    })));

    it("Should update rating using the server", async(inject([PoiService, XHRBackend], (poiService: PoiService, mockBackend: MockBackend) => {
        checkHttpRequest(mockBackend,
            (request) => {
                return request.method === RequestMethod.Post;
            });

        return poiService.uploadRating({} as IRating);
    })));
});