import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { ElevationProvider } from "./elevation.provider";
import { LoggingService } from "./logging.service";
import { PmTilesService } from "./pmtiles.service";

describe("ElevationProvider", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([])
            ],
            providers: [
                { provide: LoggingService, useValue: { warning: () => { } } },
                { provide: PmTilesService, useValue: {} },
                ElevationProvider,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should update height data", inject([ElevationProvider, HttpTestingController],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            const promise = elevationProvider.updateHeights(latlngs).then(() => {
                expect(latlngs[0].alt).toBe(1);
            });

            mockBackend.match(() => true)[0].flush([1]);
            return promise;
        }
    ));

    it("Should not call provider bacause all coordinates has elevation", inject([ElevationProvider],
        async (elevationProvider: ElevationProvider) => {

            const latlngs = [{ lat: 32, lng: 35, alt: 1 }];

            elevationProvider.updateHeights(latlngs).then(() => {
                expect(latlngs[0].alt).toBe(1);
            });
        }
    ));

    it("Should not update elevation when getting an error from server and offline is not available",
        inject([ElevationProvider, HttpTestingController],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            const promise = elevationProvider.updateHeights(latlngs);
            promise.then(() => {
                expect(latlngs[0].alt).toBe(0);
            }, () => fail());

            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
            return promise;
        }
    ));

    it("Should update elevation when getting an error from server and offline is available",
        inject([ElevationProvider, HttpTestingController, PmTilesService, Store],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController, db: PmTilesService, store: Store) => {
            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            store.reset({
                offlineState: {
                    isSubscribed: true,
                    downloadedTiles: {}
                }
            });

            // create a blue image 256x256
            const canvas = document.createElement("canvas");
            const ctx = canvas.getContext("2d");
            canvas.width = 256;
            canvas.height = 256;
            ctx.fillStyle = "blue";
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.save();
            const url = canvas.toDataURL("image/png");

            db.getTile = () => fetch(url).then(r => r.arrayBuffer());

            const promise = elevationProvider.updateHeights(latlngs);
            promise.then(() => {
                expect(latlngs[0].alt).not.toBe(0);
            }, () => fail());

            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
            return promise;
        }
    ));
});
