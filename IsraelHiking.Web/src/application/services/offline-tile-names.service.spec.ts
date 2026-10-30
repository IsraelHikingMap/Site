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

    it("should name a tile after its two most important settlements", async () => {
        const promise = service.nameTile(76, 52);
        await respondWithPlaces([
            { place: "town", name: "Big Town", population: "900000" },
            { place: "city", name: "Small City", population: "1000" },
            { place: "city", name: "Regional Capital", capital: "4", population: "10" },
            { place: "city", name: "ירושלים", "name:en": "Jerusalem", capital: "yes" }
        ]);
        await promise;

        expect(getTileName("76-52")).toBe("Jerusalem – Regional Capital");
    });

    it("should prefer the larger of two settlements of the same kind", async () => {
        const promise = service.nameTile(76, 52);
        await respondWithPlaces([
            { place: "city", name: "Smaller", population: "12,000" },
            { place: "city", name: "Larger", population: "120000 (2020)" }
        ]);
        await promise;

        expect(getTileName("76-52")).toBe("Larger – Smaller");
    });

    it("should name a tile with no settlements after the sea in it", async () => {
        const promise = service.nameTile(75, 51);
        await respondWithPlaces([{ place: "sea", name: "Levantine Sea" }]);
        await promise;

        expect(getTileName("75-51")).toBe("Levantine Sea");
    });

    it("should name an empty tile after a sea around it before a settlement around it", async () => {
        const promise = service.nameTile(75, 51);
        await respondWithPlaces([]);
        await respondWithPlaces([
            { place: "city", name: "Cairo", capital: "yes" },
            { place: "sea", name: "Levantine Sea" }
        ]);
        await promise;

        expect(getTileName("75-51")).toBe("Levantine Sea");
    });

    it("should name an empty tile with no sea around it as near the most important settlement around it", async () => {
        const promise = service.nameTile(80, 50);
        await respondWithPlaces([]);
        await respondWithPlaces([
            { place: "town", name: "Oasis" },
            { place: "city", name: "Desert City" }
        ]);
        await promise;

        expect(getTileName("80-50")).toBe("Near Desert City");
    });

    it("should number a default name another tile already has", async () => {
        store.dispatch(new SetTileNameAction("75-51", "Levantine Sea"));
        store.dispatch(new SetTileNameAction("74-51", "Levantine Sea (2)"));

        const promise = service.nameTile(75, 50);
        await respondWithPlaces([{ place: "sea", name: "Levantine Sea" }]);
        await promise;

        expect(getTileName("75-50")).toBe("Levantine Sea (3)");
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

    async function respondWithPlaces(places: Record<string, string>[]) {
        await flushMicrotasks();
        mockBackend.expectOne(Urls.overpassApi).flush({ elements: places.map(tags => ({ type: "node", tags })) });
    }

    function flushMicrotasks(): Promise<void> {
        return new Promise(resolve => setTimeout(resolve));
    }

    function getTileName(tileKey: string): string | undefined {
        return store.selectSnapshot((s: ApplicationState) => s.offlineState.tileNames)[tileKey];
    }
});
