import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule, HttpRequest } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import * as L from "leaflet";

import { ToastServiceMockCreator } from "./toast.service.spec";
import { ResourcesService } from "./resources.service";
import { WhatsAppService } from "./whatsapp.service";
import { PoiService, IPointOfInterestExtended, IRating } from "./poi.service";
import { HashService } from "./hash.service";
import { Urls } from "../common/Urls";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";

describe("Poi Service", () => {

    beforeEach(() => {
        let toastMock = new ToastServiceMockCreator();
        let hashService = {};
        let nonAngularObjectsFactory = {
            b64ToBlob: jasmine.createSpy("b64ToBlob")
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMock.resourcesService },
                { provide: HashService, useValue: hashService },
                { provide: NonAngularObjectsFactory, useValue: nonAngularObjectsFactory },
                WhatsAppService,
                PoiService
            ]
        });
    });

    it("Should get categories from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

        let promise = poiService.getCategories("Points of Interest").then((resutls) => {
            expect(resutls).not.toBeNull();
            expect(resutls.length).toBe(1);
        }, fail);

        mockBackend.match(() => true)[0].flush([{ icon: "icon", name: "category" }]);
        return promise;
    })));

    it("Should get available categories types", (inject([PoiService], (poiService: PoiService) => {
        expect(poiService.getCategoriesTypes().length).toBe(2);
    })));

    it("Should get points from server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

        let northEast = L.latLng(1, 2);
        let southWest = L.latLng(3, 4);

        let promise = poiService.getPoints(northEast, southWest, []).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne((request) => {
            let paramsString = request.params.toString();
            return paramsString.includes(northEast.lat + "," + northEast.lng) &&
                paramsString.includes(southWest.lat + "," + southWest.lng);
        }).flush({});
        return promise;
    })));

    it("Should get a point by id and source from the server", (inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

        let id = "42";
        let source = "source";

        let promise = poiService.getPoint(id, source).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne((request: HttpRequest<any>) => {
            return request.url.includes(id) &&
                request.url.includes(source);
        }).flush({});
        return promise;
    })));

    it("Should update point using the server and convert images to files",
        inject([PoiService, HttpTestingController, NonAngularObjectsFactory],
            async (poiService: PoiService, mockBackend: HttpTestingController, nonAngularObjectsFactoryMock: NonAngularObjectsFactory) => {

                let poiExtended = {
                    imagesUrls: [
                        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUAAAAFCAYAAACNbyblAAAAHElEQVQI12P4//" +
                        "8/w38GIAXDIBKE0DHxgljNBAAO9TXL0Y4OHwAAAABJRU5ErkJggg=="
                    ]
                } as IPointOfInterestExtended;
                let promise = poiService.uploadPoint(poiExtended).then((res) => {
                    expect(nonAngularObjectsFactoryMock.b64ToBlob).toHaveBeenCalled();
                    expect(res).not.toBeNull();
                });

                mockBackend.expectOne((request) => request.url.includes(Urls.poi)).flush({});
                return promise;
            }));

    it("Should update rating using the server", inject([PoiService, HttpTestingController],
        async (poiService: PoiService, mockBackend: HttpTestingController) => {

        let promise = poiService.uploadRating({} as IRating).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne((req: HttpRequest<any>) => req.method === "POST").flush({});
        return promise;
    }));
});