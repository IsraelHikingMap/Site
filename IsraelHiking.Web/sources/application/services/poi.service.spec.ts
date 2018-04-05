import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule, HttpRequest } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import * as L from "leaflet";

import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { PoiService, IPointOfInterestExtended, IRating } from "./poi.service";
import { Urls } from "../common/Urls";

describe("Poi Service", () => {

    beforeEach(() => {
        var toastMock = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                PoiService
            ]
        });
    });

    it("Should get categories from server", (inject([PoiService, HttpTestingController], async (poiService: PoiService, mockBackend: HttpTestingController) => {

        poiService.getCategories("Points of Interest").then((resutls) => {
            expect(resutls).not.toBeNull();
            expect(resutls.length).toBe(1);
        }, fail);

        mockBackend.match(() => true)[0].flush([{ icon: "icon", name: "category" }]);
    })));

    it("Should get available categories types", (inject([PoiService], (poiService: PoiService) => {
        expect(poiService.getCategoriesTypes().length).toBe(2);
    })));

    it("Should get points from server", (inject([PoiService, HttpTestingController], async (poiService: PoiService, mockBackend: HttpTestingController) => {
        let northEast = L.latLng(1, 2);
        let southWest = L.latLng(3, 4);

        poiService.getPoints(northEast, southWest, []);

        mockBackend.expectOne((request) => {
            let paramsString = request.params.toString();
            return paramsString.includes(northEast.lat + "," + northEast.lng) &&
                paramsString.includes(southWest.lat + "," + southWest.lng);
        });
    })));

    it("Should get a point by id and source from the server", (inject([PoiService, HttpTestingController], async (poiService: PoiService, mockBackend: HttpTestingController) => {
        let id = "42";
        let source = "source";
            
        poiService.getPoint(id, source);

        mockBackend.expectOne((request: HttpRequest<any>) => {
            return request.url.includes(id) &&
                request.url.includes(source)
        });
    })));

    it("Should update point using the server", inject([PoiService, HttpTestingController], async (poiService: PoiService, mockBackend: HttpTestingController) => {
        poiService.uploadPoint({} as IPointOfInterestExtended, [{name: "file.name"} as File]);

        mockBackend.expectOne((request) => request.url.includes(Urls.poi));
    }));

    it("Should update rating using the server", inject([PoiService, HttpTestingController], async (poiService: PoiService, mockBackend: HttpTestingController) => {
        poiService.uploadRating({} as IRating);

        mockBackend.expectOne((req: HttpRequest<any>) => req.method === "POST");
    }));
});