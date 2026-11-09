import { describe, beforeEach, it, expect, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";
import { LngLat } from "maplibre-gl";

import { OfflineAreasService } from "./offline-areas.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { InMemoryReducer, SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { Urls } from "../urls";
import type { ApplicationState, DownloadedArea, OfflineArea } from "../models";

const FILE = { fileName: "IHM-schema+israel-and-palestine.pmtiles", date: "2026-11-01" };

function toDownloadedAreas(...areas: OfflineArea[]): Record<string, DownloadedArea> {
    return Object.fromEntries(areas.map((area): [string, DownloadedArea] => [area.properties.id, { area, files: [], hasRoutingTiles: false }]));
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

    it("should get the areas the server offers, and none when they can not be fetched", async () => {
        const area = createArea("brandenburg", [12, 51, 15, 54]);

        const offered = service.getAreas();
        mockBackend.expectOne(Urls.offlineAreas).flush({ type: "FeatureCollection", features: [area] });
        const offline = service.getAreas();
        mockBackend.expectOne(Urls.offlineAreas).flush("offline", { status: 503, statusText: "Service Unavailable" });

        expect(await offered).toEqual([area]);
        expect(await offline).toEqual([]);
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

        expect(await service.loadAreasMetadata()).toEqual({ "israel-and-palestine": area });
        expect(fileService.listFileNamesInDataDirectory).toHaveBeenCalledWith(".area.json");
    });

    it("should keep the metadata of an area in a file of its own, and in the state only once its files are there, and delete it", async () => {
        const area = createArea("israel-and-palestine", [34, 29, 36, 34]);
        const otherArea = createArea("oberbayern", [10, 47, 13, 49]);
        store.dispatch(new SetDownloadedAreasAction({ "israel-and-palestine": { area: null, files: [FILE], hasRoutingTiles: true } }));

        await service.saveAreaMetadata(area);
        await service.saveAreaMetadata(otherArea);
        await service.deleteAreaMetadata("oberbayern");

        expect(fileService.writeFileInDataDirectory).toHaveBeenCalledWith("israel-and-palestine.area.json", JSON.stringify(area));
        expect(fileService.writeFileInDataDirectory).toHaveBeenCalledWith("oberbayern.area.json", JSON.stringify(otherArea));
        expect(getDownloadedAreas()).toEqual({ "israel-and-palestine": { area, files: [FILE], hasRoutingTiles: true } });
        expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("oberbayern.area.json");
    });

    it("should rename an area in every language", async () => {
        store.dispatch(new SetDownloadedAreasAction({ "israel-and-palestine": { area: null, files: [FILE], hasRoutingTiles: false } }));

        await service.renameDownloadedArea(createArea("israel-and-palestine", [34, 29, 36, 34], { "name:he": "ישראל" }), "Home");

        expect(getDownloadedAreas()["israel-and-palestine"].area.properties).toEqual({ id: "israel-and-palestine", name: "Home" });
    });

    describe("finding the downloaded area that holds a tile", () => {
        const area = OfflineAreasService.withZooms(createArea("israel-and-palestine", [34, 29, 36, 34]), { minZoom: 5, maxZoom: 14 });
        const root = OfflineAreasService.withZooms(OfflineAreasService.createRootArea(), { minZoom: 0, maxZoom: 4 });
        const migratedRoot = OfflineAreasService.withZooms(OfflineAreasService.createRootArea(), { minZoom: 0, maxZoom: 6 });
        const tile = OfflineAreasService.withZooms(OfflineAreasService.createTileArea(76, 51), { minZoom: 7, maxZoom: 14 });

        it("should read the root files up to their zoom and the area a tile overlaps above it, even when its middle is outside", () => {
            const downloadedAreas = toDownloadedAreas(root, area);

            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 4, 9, 6)).toBe(OfflineAreasService.ROOT_ID);
            // A tile whose middle is in the area, one along its border from 35.86 to 36.56 east, and one in the middle of the ocean
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 152, 103)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 9, 307, 206)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 10, 103)).toBeNull();
        });

        it("should not read a tile from an area it only touches, so that a tile next to an old tile is read from the area around it", () => {
            const downloadedAreas = toDownloadedAreas(migratedRoot, tile, area);

            // Right below tile 76/51, which ends where this tile starts
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 152, 104)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 8, 152, 103)).toBe("76-51");
        });

        it("should read an old tile from its own file, and fill the zooms below it from the zoom 6 root files", () => {
            const downloadedAreas = toDownloadedAreas(migratedRoot, tile);

            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 9, 305, 205)).toBe("76-51");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 6, 38, 25)).toBe(OfflineAreasService.ROOT_ID);
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 4, 9, 6)).toBe(OfflineAreasService.ROOT_ID);
        });

        it("should read the smallest of the areas that hold a tile, so that the root files only fill in where there is no area", () => {
            const largeArea: OfflineArea = { ...area, geometry: createArea("large", [30, 25, 40, 35]).geometry };
            const downloadedAreas = toDownloadedAreas(migratedRoot, largeArea);

            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 6, 38, 25)).toBe("israel-and-palestine");
            expect(OfflineAreasService.findDownloadedAreaIdOfTile(downloadedAreas, 6, 10, 25)).toBe(OfflineAreasService.ROOT_ID);
        });
    });
});
