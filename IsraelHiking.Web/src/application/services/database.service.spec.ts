import { describe, beforeEach, afterEach, vi, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { provideHttpClientTesting } from "@angular/common/http/testing";
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
});
