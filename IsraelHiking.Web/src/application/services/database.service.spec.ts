import { describe, beforeEach, afterEach, vi, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";
import Dexie from "dexie";

import { DatabaseService } from "./database.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { PmTilesService } from "./pmtiles.service";
import type { Trace } from "../models";

const DATABASE_NAMES = ["State", "UploadQueue", "Images", "ShareUrls", "Traces"];

describe("DatabaseService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([]),
                DatabaseService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
                {
                    provide: LoggingService,
                    useValue: {
                        info: vi.fn().mockName("LoggingService.info"),
                        warning: vi.fn().mockName("LoggingService.warning")
                    }
                },
                { provide: RunningContextService, useValue: { isMobile: false, isIFrame: false } },
                { provide: PmTilesService, useValue: {} }
            ]
        });
    });

    afterEach(async () => {
        const database = TestBed.inject(DatabaseService);
        await database.uninitialize();
        await database.deleteAllData();
    });

    it("Should delete every database it stores data in", inject([DatabaseService], async (service: DatabaseService) => {
        await service.initialize();
        await service.storeTrace({ id: "42" } as Trace);
        expect(await Dexie.exists("Traces")).toBe(true);

        await service.deleteAllData();

        for (const databaseName of DATABASE_NAMES) {
            expect(await Dexie.exists(databaseName)).toBe(false);
        }
    }));

    it("Should reset the state before deleting it, so that it is not stored again", inject([DatabaseService, Store], async (service: DatabaseService, store: Store) => {
        await service.initialize();
        const reset = vi.spyOn(store, "reset");

        await service.deleteAllData();

        expect(reset).toHaveBeenCalled();
    }));

    it("Should answer a slice tile the server does not have with a 404 and not as being offline",
        inject([DatabaseService, Store, PmTilesService, HttpTestingController],
            async (service: DatabaseService, store: Store, pmTilesService: PmTilesService, mockBackend: HttpTestingController) => {
                await service.initialize();
                pmTilesService.isOfflineFileAvailable = vi.fn().mockResolvedValue(false);
                const dispatch = vi.spyOn(store, "dispatch");

                const promise = service.getSliceTile("slice://mapeak.com/vector/data/raster-dem/14/9783/6797.webp");
                await vi.waitFor(() => mockBackend.expectOne("https://mapeak.com/vector/data/raster-dem/14/9783/6797.webp")
                    .flush(null, { status: 404, statusText: "Not Found" }));

                await expect(promise).rejects.toMatchObject({ status: 404 });
                expect(dispatch).not.toHaveBeenCalled();
            }
        )
    );

    it("Should read a slice tile from the offline file without asking the server shortly after the server could not be reached",
        inject([DatabaseService, PmTilesService, HttpTestingController],
            async (service: DatabaseService, pmTilesService: PmTilesService, mockBackend: HttpTestingController) => {
                await service.initialize();
                const offlineTile = new ArrayBuffer(1);
                pmTilesService.isOfflineFileAvailable = vi.fn().mockResolvedValue(true);
                pmTilesService.getTileByType = vi.fn().mockResolvedValue(offlineTile);

                const first = service.getSliceTile("slice://mapeak.com/vector/data/raster-dem/14/9783/6797.webp");
                await vi.waitFor(() => mockBackend.expectOne("https://mapeak.com/vector/data/raster-dem/14/9783/6797.webp")
                    .error(new ProgressEvent("error")));
                expect((await first).data).toBe(offlineTile);

                const second = await service.getSliceTile("slice://mapeak.com/vector/data/raster-dem/13/4891/3398.webp");

                mockBackend.expectNone("https://mapeak.com/vector/data/raster-dem/13/4891/3398.webp");
                expect(second.data).toBe(offlineTile);
            }
        )
    );

    it("Should ask the server again once a while passed since it could not be reached",
        inject([DatabaseService, PmTilesService, HttpTestingController],
            async (service: DatabaseService, pmTilesService: PmTilesService, mockBackend: HttpTestingController) => {
                await service.initialize();
                pmTilesService.isOfflineFileAvailable = vi.fn().mockResolvedValue(true);
                pmTilesService.getTileByType = vi.fn().mockResolvedValue(new ArrayBuffer(1));
                const now = Date.now();
                const dateNow = vi.spyOn(Date, "now").mockReturnValue(now);

                const first = service.getSliceTile("slice://mapeak.com/vector/data/raster-dem/14/9783/6797.webp");
                await vi.waitFor(() => mockBackend.expectOne("https://mapeak.com/vector/data/raster-dem/14/9783/6797.webp")
                    .error(new ProgressEvent("error")));
                await first;
                dateNow.mockReturnValue(now + 30000);

                const second = service.getSliceTile("slice://mapeak.com/vector/data/raster-dem/13/4891/3398.webp");
                await vi.waitFor(() => mockBackend.expectOne("https://mapeak.com/vector/data/raster-dem/13/4891/3398.webp")
                    .flush(new ArrayBuffer(2)));

                expect((await second).data.byteLength).toBe(2);
                dateNow.mockRestore();
            }
        )
    );
});
