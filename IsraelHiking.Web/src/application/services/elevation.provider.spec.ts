import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { MockNgRedux, MockNgReduxModule } from "@angular-redux2/store/testing";

import { ResourcesService } from "./resources.service";
import { ElevationProvider } from "./elevation.provider";
import { ToastService } from "./toast.service";
import { ToastServiceMockCreator } from "./toast.service.spec";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";

describe("ElevationProvider", () => {

    beforeEach(() => {
        let toastMockCreator = new ToastServiceMockCreator();
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                MockNgReduxModule
            ],
            providers: [
                { provide: ResourcesService, useValue: toastMockCreator.resourcesService },
                { provide: ToastService, useValue: toastMockCreator.toastService },
                { provide: LoggingService, useValue: { warning: () => { } } },
                { provide: DatabaseService, useValue: {} },
                ElevationProvider
            ]
        });
        MockNgRedux.reset();
    });

    it("Should update height data", inject([ElevationProvider, HttpTestingController],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

            let latlngs = [{ lat: 0, lng: 0, alt: 0 }];

            let promise = elevationProvider.updateHeights(latlngs).then(() => {
                expect(latlngs[0].alt).toBe(1);
            });

            mockBackend.match(() => true)[0].flush([1]);
            return promise;
        }));

    it("Should not call provider bacause all coordinates has elevation", inject([ElevationProvider],
        async (elevationProvider: ElevationProvider) => {

            let latlngs = [{ lat: 0, lng: 0, alt: 1 }];

            elevationProvider.updateHeights(latlngs).then(() => {
                expect(latlngs[0].alt).toBe(1);
            });
        }));

    it("Should raise toast when error occurs", inject([ElevationProvider, HttpTestingController, ToastService],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController, toastService: ToastService) => {

            let latlngs = [{ lat: 0, lng: 0, alt: 0 }];
            spyOn(toastService, "warning");

            let promise = elevationProvider.updateHeights(latlngs);
            promise.then(() => {
                expect(toastService.warning).toHaveBeenCalled();
            }, () => fail());

            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
            return promise;
        }));
});
