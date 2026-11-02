import { describe, beforeEach, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { PmTilesService, ROOT_ZOOM } from "./pmtiles.service";
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

    it("should read the root files up to their zoom and the area a tile is in above it", () => {
        store.dispatch(new SetDownloadedAreasAction({ [area.properties.id]: area }));
        store.dispatch(new SetDownloadedTilesAction({ [PmTilesService.toTileKey()]: [{ fileName: "IHM-schema-4.pmtiles", date: "2026-11-01" }], [area.properties.id]: [file] }));

        expect(getFileName(ROOT_ZOOM, 9, 6)).toBe("IHM-schema-4.pmtiles");
        // A tile whose middle is in the area, and one in the middle of the ocean
        expect(getFileName(8, 152, 103)).toBe("IHM-schema+israel-and-palestine.pmtiles");
        expect(getFileName(8, 10, 103)).toBeNull();
    });

    it("should read a tile that came before areas from its own file, and fill the zooms below it from the zoom 6 root files", () => {
        store.dispatch(new SetDownloadedTilesAction({
            [PmTilesService.LEGACY_ROOT_KEY]: [{ fileName: "IHM-schema-6.pmtiles", date: "2025-01-01" }],
            "76-51": [{ fileName: "IHM-schema+76-51.pmtiles", date: "2025-01-01" }]
        }));

        expect(getFileName(9, 305, 205)).toBe("IHM-schema+76-51.pmtiles");
        expect(getFileName(6, 38, 25)).toBe("IHM-schema-6.pmtiles");
        expect(getFileName(ROOT_ZOOM, 9, 6)).toBe("IHM-schema-6.pmtiles");
    });

    function getFileName(z: number, x: number, y: number): string | null {
        return service["getFileNameByType"](z, x, y, "IHM-schema");
    }
});
