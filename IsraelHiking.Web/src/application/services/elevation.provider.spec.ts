import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { ElevationProvider } from "./elevation.provider";
import { LoggingService } from "./logging.service";
import { PmTilesService } from "./pmtiles.service";

describe("ElevationProvider", () => {

    async function getArrayBufferOfNonEmptyTile(): Promise<ArrayBuffer> {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = 256;
        canvas.height = 256;
        ctx.fillStyle = "blue";
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
                { provide: PmTilesService, useValue: {} },
                ElevationProvider,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should update height data", inject([ElevationProvider, HttpTestingController, Store],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                offlineState: {
                    isOfflineAvailable: false,
                }
            });
            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            const promise = elevationProvider.updateHeights(latlngs);
            await new Promise((resolve) => setTimeout(resolve, 0)); // Let the http call be made

            mockBackend.match(() => true)[0].flush(await getArrayBufferOfNonEmptyTile());
            await promise;
            expect(latlngs[0].alt).toBe(-9974.5);
        }
    ));

    it("Should not call provider bacause all coordinates has elevation", inject([ElevationProvider],
        async (elevationProvider: ElevationProvider) => {

            const latlngs = [{ lat: 32, lng: 35, alt: 1 }];

            await elevationProvider.updateHeights(latlngs);

            expect(latlngs[0].alt).toBe(1);
        }
    ));

    it("Should not update elevation when getting an error from server and offline is not available",
        inject([ElevationProvider, HttpTestingController, Store],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                offlineState: {
                    isOfflineAvailable: false,
                }
            });

            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            const promise = elevationProvider.updateHeights(latlngs);

            await new Promise((resolve) => setTimeout(resolve, 0)); // Let the http call be made

            mockBackend.match(() => true)[0].flush(null, { status: 500, statusText: "Server Error" });
            await promise;
            expect(latlngs[0].alt).toBe(0);
        }
    ));

    it("Should update elevation when offline is available",
        inject([ElevationProvider, HttpTestingController, PmTilesService, Store],
        async (elevationProvider: ElevationProvider, mockBackend: HttpTestingController, db: PmTilesService, store: Store) => {
            const latlngs = [{ lat: 32, lng: 35, alt: 0 }];

            store.reset({
                offlineState: {
                    isOfflineAvailable: true,
                    lastModifiedDate: new Date()
                }
            });

            db.getTile = () => getArrayBufferOfNonEmptyTile();

            const promise = elevationProvider.updateHeights(latlngs);

            await promise;
            expect(latlngs[0].alt).not.toBe(0);
        }
    ));
});
