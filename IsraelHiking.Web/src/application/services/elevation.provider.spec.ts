import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule } from "@ngxs/store";

import { ElevationProvider } from "./elevation.provider";
import { LoggingService } from "./logging.service";
import { PmTilesService } from "./pmtiles.service";

describe("ElevationProvider", () => {

    async function getArrayBufferOfNonEmptyTile(): Promise<ArrayBuffer> {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 512;
        canvas.height = 512;
        ctx.fillStyle = "red";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.save();
        const url = canvas.toDataURL("image/png");

        const response = await fetch(url);
        return response.arrayBuffer();
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([])
            ],
            providers: [
                { provide: LoggingService, useValue: { warning: () => { } } },
                { provide: PmTilesService, useValue: {
                    isOfflineFileAvailable: () => false,
                } },
                ElevationProvider,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should update height data", inject([ElevationProvider, HttpTestingController],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            const promise = elevationProvider.updateHeights(latlngs);

            mockBackend.match(() => true)[0].flush(await getArrayBufferOfNonEmptyTile());
            await promise;
            expect(latlngs[0].alt).toBe(32512);
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

            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
            await promise;
            expect(latlngs[0].alt).toBe(0);
        }
    ));

    it("Should update elevation when offline is available",
        inject([ElevationProvider, PmTilesService],
        async (elevationProvider: ElevationProvider, db: PmTilesService) => {
            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            db.isOfflineFileAvailable = () => true;
            db.getTileAboveZoom = getArrayBufferOfNonEmptyTile;

            const promise = elevationProvider.updateHeights(latlngs);

            await promise;
            expect(latlngs[0].alt).not.toBe(0);
        }
    ));
});
