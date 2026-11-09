import { describe, beforeEach, it, expect } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideStore, Store } from "@ngxs/store";

import { AREA_MIN_ZOOM, PmTilesService, ROOT_ZOOM, TILES_ZOOM } from "./pmtiles.service";
import { LoggingService } from "./logging.service";
import { OfflineAreasService } from "./offline-areas.service";
import { InMemoryReducer, SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import type { DownloadedArea, OfflineArea } from "../models";

describe("PmTilesService", () => {
    let service: PmTilesService;
    let store: Store;
    const area: OfflineArea = {
        type: "Feature",
        properties: { id: "israel-and-palestine", name: "Israel", minZoom: AREA_MIN_ZOOM },
        geometry: { type: "Polygon", coordinates: [[[34, 29], [36, 29], [36, 34], [34, 34], [34, 29]]] }
    };
    const root = OfflineAreasService.createRootArea(PmTilesService.ROOT_KEY, ROOT_ZOOM);
    const legacyRoot = OfflineAreasService.createRootArea(PmTilesService.LEGACY_ROOT_KEY, TILES_ZOOM - 1);
    const tile = OfflineAreasService.createTileArea(76, 51);

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

    it("should find the downloaded area a point is in, only at the zooms its files hold", () => {
        setDownloadedAreas(area);

        expect(service.findDownloadedAreaId(point(35, 32), 8)).toBe("israel-and-palestine");
        expect(service.findDownloadedAreaId(point(35, 32), ROOT_ZOOM)).toBeNull();
        expect(service.findDownloadedAreaId(point(40, 32), 8)).toBeNull();
    });

    it("should read the root files up to their zoom and the area a tile is in above it", () => {
        setDownloadedAreas(root, area);

        expect(getFileName(ROOT_ZOOM, 9, 6)).toBe("IHM-schema+root.pmtiles");
        // A tile whose middle is in the area, and one in the middle of the ocean
        expect(getFileName(8, 152, 103)).toBe("IHM-schema+israel-and-palestine.pmtiles");
        expect(getFileName(8, 10, 103)).toBeNull();
    });

    it("should read a tile along the border of an area from the area even when the middle of the tile is outside it", () => {
        setDownloadedAreas(root, area);

        // 35.86 to 36.56 east, the area ends at 36
        expect(getFileName(9, 307, 206)).toBe("IHM-schema+israel-and-palestine.pmtiles");
    });

    it("should read a tile that came before areas from its own file, and fill the zooms below it from the zoom 6 root files", () => {
        setDownloadedAreas(legacyRoot, tile);

        expect(getFileName(9, 305, 205)).toBe("IHM-schema+76-51.pmtiles");
        expect(getFileName(6, 38, 25)).toBe("IHM-schema+legacy-root.pmtiles");
        expect(getFileName(ROOT_ZOOM, 9, 6)).toBe("IHM-schema+legacy-root.pmtiles");
    });

    it("should read the smallest of the areas that hold a tile, so that the root files only fill in where there is no area", () => {
        const largeArea: OfflineArea = { ...area, geometry: { type: "Polygon", coordinates: [[[30, 25], [40, 25], [40, 35], [30, 35], [30, 25]]] } };
        setDownloadedAreas(legacyRoot, largeArea);

        expect(getFileName(6, 38, 25)).toBe("IHM-schema+israel-and-palestine.pmtiles");
        expect(getFileName(6, 10, 25)).toBe("IHM-schema+legacy-root.pmtiles");
    });

    function setDownloadedAreas(...areas: OfflineArea[]) {
        const downloadedAreas: Record<string, DownloadedArea> = {};
        for (const downloadedArea of areas) {
            downloadedAreas[downloadedArea.properties.id] = { area: downloadedArea, files: [], hasRoutingTiles: false };
        }
        store.dispatch(new SetDownloadedAreasAction(downloadedAreas));
    }

    function point(lng: number, lat: number): GeoJSON.Point {
        return { type: "Point", coordinates: [lng, lat] };
    }

    function getFileName(z: number, x: number, y: number): string | null {
        return service["getFileNameByType"](z, x, y, "IHM-schema");
    }
});
