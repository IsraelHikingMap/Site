import { describe, beforeEach, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore } from "@ngxs/store";

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

        return new Promise<ArrayBuffer>((resolve, reject) => {
            canvas.toBlob((blob) => {
                if (!blob) {
                    reject(new Error("canvas.toBlob returned null"));
                    return;
                }
                resolve(blob.arrayBuffer());
            }, "image/png");
        });
    }

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([]),
                { provide: LoggingService, useValue: { warning: () => { } } },
                {
                    provide: PmTilesService, useValue: {
                        isOfflineFileAvailable: () => Promise.resolve(false)
                    }
                },
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
            await new Promise((resolve) => setTimeout(resolve, 0)); // Let the http call be made

            mockBackend.match(() => true)[0].flush(await getArrayBufferOfNonEmptyTile());
            await promise;
            expect(latlngs[0].alt).toBe(32512);
        }
    ));

    it("Should not call provider because all coordinates have elevation", inject([ElevationProvider],
        async (elevationProvider: ElevationProvider) => {

            const latlngs = [{ lat: 32, lng: 35, alt: 1 }];

            await elevationProvider.updateHeights(latlngs);

            expect(latlngs[0].alt).toBe(1);
        }
    ));

    it("Should not update elevation when getting an error from server for all the zoom levels and offline is not available",
        inject([ElevationProvider, HttpTestingController],
            async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

                const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

                const promise = elevationProvider.updateHeights(latlngs);

                for (let zoom = ElevationProvider.MAX_ELEVATION_ZOOM; zoom >= ElevationProvider.FALLBACK_ELEVATION_ZOOM; zoom--) {
                    await new Promise((resolve) => setTimeout(resolve, 0)); // Let the http call be made
                    mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
                }
                await promise;
                expect(latlngs[0].alt).toBe(0);
            }
        ));

    it("Should update elevation from a lower zoom tile when the highest zoom tile is not served",
        inject([ElevationProvider, HttpTestingController],
            async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController) => {

                const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

                const promise = elevationProvider.updateHeights(latlngs);

                await new Promise((resolve) => setTimeout(resolve, 0)); // Let the http call be made
                const failed = mockBackend.match(() => true)[0];
                expect(failed.request.url).toContain(`/${ElevationProvider.MAX_ELEVATION_ZOOM}/`);
                failed.flush(null, { status: 500, statusText: "Server Error" });

                await new Promise((resolve) => setTimeout(resolve, 0)); // Let the fallback http call be made
                const fallback = mockBackend.match(() => true)[0];
                expect(fallback.request.url).toContain(`/${ElevationProvider.MAX_ELEVATION_ZOOM - 1}/`);
                fallback.flush(await getArrayBufferOfNonEmptyTile());

                await promise;
                expect(latlngs[0].alt).toBe(32512);
            }
        ));

    it("Should update elevation when offline is available",
        inject([ElevationProvider, PmTilesService],
            async (elevationProvider: ElevationProvider, db: PmTilesService) => {
                const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

                db.isOfflineFileAvailable = () => Promise.resolve(true);
                db.getTileByType = getArrayBufferOfNonEmptyTile;

                const promise = elevationProvider.updateHeights(latlngs);

                await promise;
                expect(latlngs[0].alt).not.toBe(0);
            }
        ));
});
