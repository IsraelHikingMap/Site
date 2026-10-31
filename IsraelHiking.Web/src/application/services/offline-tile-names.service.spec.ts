import { describe, beforeEach, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";

import { OfflineTileNamesService } from "./offline-tile-names.service";
import { OverpassTurboService } from "./overpass-turbo.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { OfflineReducer, SetTileNameAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ApplicationState } from "../models";

describe("OfflineTileNamesService", () => {
    let service: OfflineTileNamesService;
    let mockBackend: HttpTestingController;
    let store: Store;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([OfflineReducer]),
                {
                    provide: ResourcesService,
                    useValue: { getCurrentLanguageCodeSimplified: () => "en", nearPlace: "Near {{place}}" }
                },
                { provide: LoggingService, useValue: { warning: () => { } } },
                OverpassTurboService,
                OfflineTileNamesService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
        service = TestBed.inject(OfflineTileNamesService);
        mockBackend = TestBed.inject(HttpTestingController);
        store = TestBed.inject(Store);
    });

    it("should name a tile after the region its center is in", async () => {
        const promise = service.nameTile(76, 52);
        await respondWithRegions([
            { name: "مأدبا", "name:en": "Madaba", bounds: [31.0, 35.5, 32.0, 36.0] },
            { name: "מחוז ירושלים", "name:en": "Jerusalem District", bounds: [30.5, 34.8, 31.0, 35.3] }
        ]);
        await promise;

        expect(getTileName("76-52")).toBe("Jerusalem District");
    });

    it("should prefer the smaller of two regions the center is in", async () => {
        const promise = service.nameTile(76, 52);
        await respondWithRegions([
            { name: "Large", bounds: [29.0, 33.0, 34.0, 38.0] },
            { name: "Small", bounds: [30.5, 34.8, 31.0, 35.3] }
        ]);
        await promise;

        expect(getTileName("76-52")).toBe("Small");
    });

    it("should name a tile whose center is in no region as near the closest region", async () => {
        const promise = service.nameTile(75, 52);
        await respondWithRegions([
            { name: "Far", bounds: [30.0, 34.6, 31.0, 35.0] },
            { name: "Close", bounds: [30.0, 33.5, 31.0, 34.0] }
        ]);
        await promise;

        expect(getTileName("75-52")).toBe("Near Close");
    });

    it("should leave a tile without regions without a name", async () => {
        const promise = service.nameTile(75, 52);
        await respondWithRegions([]);
        await promise;

        expect(getTileName("75-52")).toBeUndefined();
    });

    it("should number a default name another tile already has", async () => {
        store.dispatch(new SetTileNameAction("75-52", "Region"));
        store.dispatch(new SetTileNameAction("74-52", "Region (2)"));

        const promise = service.nameTile(76, 52);
        await respondWithRegions([{ name: "Region", bounds: [29.0, 33.0, 34.0, 38.0] }]);
        await promise;

        expect(getTileName("76-52")).toBe("Region (3)");
    });

    it("should leave a tile without a name when the places can not be fetched", async () => {
        const promise = service.nameTile(76, 52);
        await flushMicrotasks();
        mockBackend.expectOne(Urls.overpassApi).flush("offline", { status: 503, statusText: "Service Unavailable" });
        await promise;

        expect(getTileName("76-52")).toBeUndefined();
    });

    it("should not look up a tile that already has a name", async () => {
        store.dispatch(new SetTileNameAction("76-52", "My tile"));

        await service.nameTile(76, 52);

        mockBackend.expectNone(Urls.overpassApi);
        expect(getTileName("76-52")).toBe("My tile");
    });

    /** Each region's bounds are south, west, north, east, the way Overpass orders a box */
    async function respondWithRegions(regions: ({ bounds: number[] } & Record<string, string | number[]>)[]) {
        await flushMicrotasks();
        mockBackend.expectOne(Urls.overpassApi).flush({
            elements: regions.map(({ bounds: [minlat, minlon, maxlat, maxlon], ...tags }) =>
                ({ type: "relation", tags, bounds: { minlat, minlon, maxlat, maxlon } }))
        });
    }

    function flushMicrotasks(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve));
    }

    function getTileName(tileKey: string): string | undefined {
        return store.selectSnapshot((s: ApplicationState) => s.offlineState.tileNames)[tileKey];
    }
});
