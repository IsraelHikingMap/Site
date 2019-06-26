import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { RouterService } from "./router.service";
import { ResourcesService } from "../resources.service";
import { ToastService } from "../toast.service";
import { GeoJsonParser } from "../geojson.parser";
import { ToastServiceMockCreator } from "../toast.service.spec";

describe("RouterService", () => {
    beforeEach(() => {
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                GeoJsonParser,
                RouterService
            ]
        });
    });

    it("Should route between two points", (inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {
            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, "Hike").then((data) => {
                expect(data.length).toBe(2);
                expect(data[1].latlngs.length).toBe(3);
            }, fail);

            mockBackend.expectOne(() => true).flush(
                {
                    type: "FeatureCollection",
                    features: [
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
                } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>);
            return promise;
        })));

    it("Should use none router when reponse is not a geojson", inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {

            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, "Hike").then((data) => {
                expect(data.length).toBe(1);
                expect(data[0].latlngs.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush({});
            return promise;
        }));

    it("Should use none router when getting error response from server", inject([RouterService, HttpTestingController],
        async (router: RouterService, mockBackend: HttpTestingController) => {

            let promise = router.getRoute({ lat: 1, lng: 1 }, { lat: 2, lng: 2 }, "Hike").then((data) => {
                expect(data.length).toBe(1);
                expect(data[0].latlngs.length).toBe(2);
            }, fail);

            mockBackend.expectOne(() => true).flush(null, { status: 500, statusText: "Server error" });
            return promise;
        }));
});
