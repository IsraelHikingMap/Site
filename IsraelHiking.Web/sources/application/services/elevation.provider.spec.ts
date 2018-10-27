﻿import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { ResourcesService } from "./resources.service";
import { ElevationProvider } from "./elevation.provider";
import { ToastService } from "./toast.service";
import { ToastServiceMockCreator } from "./toast.service.spec";

describe("ElevationProvider", () => {

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
                ElevationProvider
            ]
        });
    });

    it("Should update height data", inject([ElevationProvider, HttpTestingController],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

            let latlngs = [{ lat: 0, lng: 0, alt: 0 }];

            let promise = elevationProvider.updateHeights(latlngs).then((lls) => {
                expect(lls[0].alt).toBe(1);
            });

            mockBackend.match(() => true)[0].flush([1]);
            return promise;
        }));

    it("Should not call provider bacause all coordinates has elevation", inject([ElevationProvider],
        async (elevationProvider: ElevationProvider) => {

            let latlngs = [{ lat: 0, lng: 0, alt: 1 }];

            elevationProvider.updateHeights(latlngs).then((lls => {
                expect(lls[0].alt).toBe(1);
            }));
        }));

    it("Should raise toast when error occurs", inject([ElevationProvider, HttpTestingController, ToastService],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController, toastService: ToastService) => {

            let latlngs = [{ lat: 0, lng: 0, alt: 0 }];
            spyOn(toastService, "error");

            let promise = elevationProvider.updateHeights(latlngs).then(() => fail(), () => {
                expect(toastService.error).toHaveBeenCalled();
            });

            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
            return promise;
        }));
});