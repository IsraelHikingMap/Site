import { describe, beforeEach, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { PmTilesService } from "./pmtiles.service";
import { LoggingService } from "./logging.service";
import { OfflineAreasService } from "./offline-areas.service";
import { InMemoryReducer, SetDownloadedAreasAction, SetDownloadedTilesAction } from "../reducers/in-memory.reducer";
import type { OfflineArea } from "../models";

describe("PmTilesService", () => {
    let service: PmTilesService;
    let store: Store;
    const area: OfflineArea = {
        type: "Feature",
        properties: { id: "israel-and-palestine", name: "Israel" },
        geometry: { type: "Polygon", coordinates: [[[34, 29], [36, 29], [36, 34], [34, 34], [34, 29]]] }
    };
    const file = { fileName: "IHM-schema+israel-and-palestine.pmtiles", date: "2026-11-01" };

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([InMemoryReducer]),
                { provide: LoggingService, useValue: { warning: () => { } } },
                PmTilesService
            ]
        });
        service = TestBed.inject(PmTilesService);
        store = TestBed.inject(Store);
    });

    it("should find the downloaded area a point is in", () => {
        store.dispatch(new SetDownloadedAreasAction({ [area.properties.id]: area }));
        store.dispatch(new SetDownloadedTilesAction({ [area.properties.id]: [file] }));

        expect(service.findDownloadedAreaId([35, 32])).toBe("israel-and-palestine");
        expect(service.findDownloadedAreaId([40, 32])).toBeNull();
    });

    it("should not find an area whose files are not on the device", () => {
        store.dispatch(new SetDownloadedAreasAction({ [area.properties.id]: area }));

        expect(service.findDownloadedAreaId([35, 32])).toBeNull();
    });

    it("should not find a tile, which is found by the tile itself", () => {
        const tile = OfflineAreasService.createTileArea(76, 51);
        store.dispatch(new SetDownloadedAreasAction({ [tile.properties.id]: tile }));
        store.dispatch(new SetDownloadedTilesAction({ [tile.properties.id]: [file] }));

        expect(service.findDownloadedAreaId([35, 32])).toBeNull();
    });
});
