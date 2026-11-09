import { describe, beforeEach, it, expect, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";
import { LngLat } from "maplibre-gl";

import { AREA_MIN_ZOOM, OfflineAreasService, ROOT_ZOOM, TILES_ZOOM } from "./offline-areas.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { InMemoryReducer, SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { Urls } from "../urls";
import type { ApplicationState, DownloadedArea, OfflineArea } from "../models";

const FILE = { fileName: "IHM-schema+israel-and-palestine.pmtiles", date: "2026-11-01" };

describe("OfflineAreasService", () => {
    let service: OfflineAreasService;
    let mockBackend: HttpTestingController;
    let store: Store;
    let fileService: FileService;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([InMemoryReducer]),
                { provide: ResourcesService, useValue: { getCurrentLanguageCodeSimplified: () => "he" } },
                { provide: LoggingService, useValue: { warning: () => { } } },
                {
                    provide: FileService, useValue: {
                        listFileNamesInDataDirectory: vi.fn(() => Promise.resolve([] as string[])),
                        readFileInDataDirectory: vi.fn(),
                        writeFileInDataDirectory: vi.fn(() => Promise.resolve()),
                        deleteFileInDataDirectory: vi.fn(() => Promise.resolve())
                    }
                },
                OfflineAreasService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
        service = TestBed.inject(OfflineAreasService);
        mockBackend = TestBed.inject(HttpTestingController);
        store = TestBed.inject(Store);
        fileService = TestBed.inject(FileService);
    });

    it("should get the areas the server offers", async () => {
        const area = createArea("brandenburg", [12, 51, 15, 54]);

        const promise = service.getAreas();
        mockBackend.expectOne(Urls.offlineAreas).flush({ type: "FeatureCollection", features: [area] });

        expect(await promise).toEqual([area]);
    });

    it("should have no areas when they can not be fetched", async () => {
        const promise = service.getAreas();
        mockBackend.expectOne(Urls.offlineAreas).flush("offline", { status: 503, statusText: "Service Unavailable" });

        expect(await promise).toEqual([]);
    });

    it("should find the smallest of the areas at a point", () => {
        const brandenburg = createArea("brandenburg", [12, 51, 15, 54]);
        const berlin = createArea("berlin", [13, 52, 14, 53]);

        expect(service.findArea([brandenburg, berlin], new LngLat(13.5, 52.5))).toBe(berlin);
        expect(service.findArea([brandenburg, berlin], new LngLat(12.5, 51.5))).toBe(brandenburg);
        expect(service.findArea([brandenburg, berlin], new LngLat(20, 51.5))).toBeNull();
    });

    it("should name an area in the language of the app, and in English when it has no name in it", () => {
        expect(service.getName(createArea("israel-and-palestine", [34, 29, 36, 34], { "name:he": "ישראל" }))).toBe("ישראל");
        expect(service.getName(createArea("oberbayern", [10, 47, 13, 49]))).toBe("oberbayern");
    });

    it("should read the areas that are kept on the device, skipping a file that can not be read", async () => {
        const area = createArea("israel-and-palestine", [34, 29, 36, 34]);
        vi.mocked(fileService.listFileNamesInDataDirectory).mockResolvedValue(["israel-and-palestine.area.json", "broken.area.json"]);
        vi.mocked(fileService.readFileInDataDirectory).mockImplementation(fileName =>
            Promise.resolve(fileName === "broken.area.json" ? "{" : JSON.stringify(area)));

        expect(await service.loadDownloadedAreas()).toEqual({ "israel-and-palestine": area });
        expect(fileService.listFileNamesInDataDirectory).toHaveBeenCalledWith(".area.json");
    });

    it("should keep an area in a file of its own and in the state when its files are there", async () => {
        const area = createArea("israel-and-palestine", [34, 29, 36, 34]);
        store.dispatch(new SetDownloadedAreasAction({ "israel-and-palestine": { area: null, files: [FILE], hasRoutingTiles: true } }));

        await service.saveDownloadedArea(area);

        expect(fileService.writeFileInDataDirectory).toHaveBeenCalledWith("israel-and-palestine.area.json", JSON.stringify(area));
        expect(getDownloadedAreas()).toEqual({ "israel-and-palestine": { area, files: [FILE], hasRoutingTiles: true } });
    });

    it("should only keep an area in its file while its files are not there yet, they are read into the state along with it", async () => {
        await service.saveDownloadedArea(createArea("israel-and-palestine", [34, 29, 36, 34]));

        expect(fileService.writeFileInDataDirectory).toHaveBeenCalled();
        expect(getDownloadedAreas()).toEqual({});
    });

    it("should delete the file an area is kept in", async () => {
        await service.deleteDownloadedArea("israel-and-palestine");

        expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("israel-and-palestine.area.json");
    });

    it("should rename an area in every language", async () => {
        store.dispatch(new SetDownloadedAreasAction({ "israel-and-palestine": { area: null, files: [FILE], hasRoutingTiles: false } }));

        await service.renameDownloadedArea(createArea("israel-and-palestine", [34, 29, 36, 34], { "name:he": "ישראל" }), "Home");

        expect(getDownloadedAreas()["israel-and-palestine"].area.properties).toEqual({ id: "israel-and-palestine", name: "Home" });
    });

    it("should make a tile an area whose id is the key of the tile", () => {
        const tile = OfflineAreasService.createTileArea(76, 51);

        expect(tile.properties).toEqual({ id: "76-51", minZoom: 7 });
        expect(tile.geometry.type).toBe("Polygon");
        expect((tile.geometry as GeoJSON.Polygon).coordinates[0]).toHaveLength(5);
    });

    describe("finding the downloaded area that holds a tile", () => {
        const area: OfflineArea = { ...createArea("israel-and-palestine", [34, 29, 36, 34]), properties: { id: "israel-and-palestine", minZoom: AREA_MIN_ZOOM } };
        const root = OfflineAreasService.createRootArea(OfflineAreasService.ROOT_KEY, ROOT_ZOOM);
        const legacyRoot = OfflineAreasService.createRootArea(OfflineAreasService.LEGACY_ROOT_KEY, TILES_ZOOM - 1);
        const tile = OfflineAreasService.createTileArea(76, 51);

        it("should find the downloaded area a point is in, only at the zooms its files hold", () => {
            const downloadedAreas = toDownloadedAreas(area);

            expect(OfflineAreasService.findDownloadedAreaId(downloadedAreas, point(35, 32), 8)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaId(downloadedAreas, point(35, 32), ROOT_ZOOM)).toBeNull();
            expect(OfflineAreasService.findDownloadedAreaId(downloadedAreas, point(40, 32), 8)).toBeNull();
        });

        it("should read the root files up to their zoom and the area a tile is in above it", () => {
            const downloadedAreas = toDownloadedAreas(root, area);

            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, ROOT_ZOOM, 9, 6)).toBe(OfflineAreasService.ROOT_KEY);
            // A tile whose middle is in the area, and one in the middle of the ocean
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 152, 103)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 10, 103)).toBeNull();
        });

        it("should read a tile along the border of an area from the area even when the middle of the tile is outside it", () => {
            // 35.86 to 36.56 east, the area ends at 36
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(toDownloadedAreas(root, area), 9, 307, 206)).toBe("israel-and-palestine");
        });

        it("should not read a tile from an area it only touches, so that a tile next to one that came before areas is read from the area around it", () => {
            const downloadedAreas = toDownloadedAreas(legacyRoot, tile, area);

            // Right below tile 76/51, which ends where this tile starts
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 152, 104)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 152, 103)).toBe("76-51");
        });

        it("should read a tile that came before areas from its own file, and fill the zooms below it from the zoom 6 root files", () => {
            const downloadedAreas = toDownloadedAreas(legacyRoot, tile);

            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 9, 305, 205)).toBe("76-51");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 6, 38, 25)).toBe(OfflineAreasService.LEGACY_ROOT_KEY);
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, ROOT_ZOOM, 9, 6)).toBe(OfflineAreasService.LEGACY_ROOT_KEY);
        });

        it("should read the smallest of the areas that hold a tile, so that the root files only fill in where there is no area", () => {
            const largeArea: OfflineArea = { ...area, geometry: createArea("large", [30, 25, 40, 35]).geometry };
            const downloadedAreas = toDownloadedAreas(legacyRoot, largeArea);

            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 6, 38, 25)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 6, 10, 25)).toBe(OfflineAreasService.LEGACY_ROOT_KEY);
        });
    });

    function toDownloadedAreas(...areas: OfflineArea[]): Record<string, DownloadedArea> {
        return Object.fromEntries(areas.map((area): [string, DownloadedArea] => [area.properties.id, { area, files: [], hasRoutingTiles: false }]));
    }

    function point(lng: number, lat: number): GeoJSON.Point {
        return { type: "Point", coordinates: [lng, lat] };
    }

    function createArea(id: string, [minLng, minLat, maxLng, maxLat]: number[], names: Record<string, string> = {}): OfflineArea {
        return {
            type: "Feature",
            properties: { id, name: id, ...names },
            geometry: {
                type: "Polygon",
                coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]]
            }
        };
    }

    function getDownloadedAreas() {
        return store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
    }
});
