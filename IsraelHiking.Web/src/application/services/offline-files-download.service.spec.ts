import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { Router } from "@angular/router";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { OfflineReducer } from "../reducers/offline.reducer";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import { FileService, type FileDownloadProgressCallback } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { PmTilesService } from "./pmtiles.service";
import { RoutingProvider } from "./routing.provider";
import { RunningContextService } from "./running-context.service";
import { OfflineAreasService, type AreaZooms } from "./offline-areas.service";
import { SpatialHelper } from "./spatial.helper";
import { Urls } from "../urls";
import type { ApplicationState, OfflineArea } from "../models";

const ROOT_ID = OfflineAreasService.ROOT_ID;
const TILE_ID = "76-51";
const TILE_AREA: OfflineArea = { type: "Feature", properties: { id: TILE_ID }, geometry: SpatialHelper.getTilePolygon({ x: 76, y: 51 }, 7) };
/** The zooms the root files that come with an area hold */
const ROOT_ZOOMS = { minZoom: 0, maxZoom: 4 };
/** The file of the tile as it is kept on the device */
const MAP_FILE = "IHM-schema+76-51.pmtiles";
/** The file of the tile as the apps that came before areas named it */
const SERVER_MAP_FILE = "IHM-schema+7-76-51.pmtiles";
/** An area far from the tile, which downloading it does not delete */
const AREA_ID = "5a46cb2cd3d6abed";
const AREA: OfflineArea = {
    type: "Feature",
    properties: { id: AREA_ID, name: "Area" },
    geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]] }
};
const OTHER_AREA: OfflineArea = { ...AREA, properties: { id: "0f1e2d3c4b5a6978", name: "Other area" } };
const AREA_MAP_FILE = `IHM-schema+${AREA_ID}.pmtiles`;
const AREA_ROUTING_TILES_FILE = `valhalla+${AREA_ID}.tar`;
const ROOT_MAP_FILE = "IHM-schema+root.pmtiles";
const DOWNLOAD_DATE = new Date("2026-01-01T10:00:00.000Z");
const FILE_SIZE = 1024 * 1024;

/** The minimal version a style requires from each of its sources, keyed by the name used in the style */
type MinVersions = Record<string, string>;

/**
 * The sources of the real styles - the name of a source and the name of the file it is downloaded as,
 * taken from the source's url, are not the same.
 */
function createStyle(minVersions: MinVersions) {
    return {
        version: 8,
        metadata: Object.fromEntries(Object.entries(minVersions).map(([name, version]) => [`sources:${name}:min-version`, version])),
        sources: {
            "IHM": { type: "vector", url: "https://mapeak.com/vector/data/IHM-schema.json" },
            "IHM-code": { type: "vector", url: "https://mapeak.com/vector/data/IHM-code.json" },
            "DEM": { type: "raster-dem", url: "https://mapeak.com/vector/data/raster-dem.json" }
        },
        layers: [] as object[]
    };
}

/**
 * Runs the initialization, which reads the files of the device into the state and the versions the
 * styles require, with the routing tiles of the tile the tests use already downloaded.
 */
async function initialize(service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
    hikeMinVersions: MinVersions, bikeMinVersions: MinVersions = {}) {
    store.reset({
        userState: { token: "token" },
        offlineState: { isSubscribed: true },
        inMemoryState: { downloadedAreas: {} }
    });
    const promise = service.initialize();
    await flushStyles(mockBackend, hikeMinVersions, bikeMinVersions);
    await promise;
}

async function flushStyles(mockBackend: HttpTestingController, hikeMinVersions: MinVersions, bikeMinVersions: MinVersions = {}) {
    for (const [url, minVersions] of [[Urls.HIKING_STYLE_ADDRESS, hikeMinVersions], [Urls.MTB_STYLE_ADDRESS, bikeMinVersions]] as [string, MinVersions][]) {
        (await vi.waitFor(() => mockBackend.expectOne(url))).flush(JSON.stringify(createStyle(minVersions)));
    }
}

/** Answers the request for the list of the files of an area that need to be downloaded, the root files among them */
async function flushFilesToDownload(mockBackend: HttpTestingController, files: Record<string, string>, areaId = AREA_ID): Promise<TestRequest> {
    const request = await vi.waitFor(() => mockBackend.expectOne(r => r.url === `${Urls.offlineArea}/${areaId}`));
    request.flush(files);
    return request;
}

/** Keeps the areas it is given in memory, the way the real one keeps them in their files */
function createOfflineAreasService() {
    const areas: Record<string, Immutable<OfflineArea>> = {};
    return {
        loadAreasMetadata: vi.fn(() => Promise.resolve({ ...areas })),
        saveAreaMetadata: vi.fn((area: Immutable<OfflineArea>, zooms: AreaZooms) => {
            areas[area.properties.id] = { ...area, properties: { ...area.properties, ...zooms } };
            return Promise.resolve();
        }),
        deleteAreaMetadata: vi.fn((id: string) => {
            delete areas[id];
            return Promise.resolve();
        })
    };
}

function createSquareArea(id: string, [minLng, minLat, maxLng, maxLat]: number[]): OfflineArea {
    return {
        type: "Feature",
        properties: { id },
        geometry: { type: "Polygon", coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]] }
    };
}

/** The zooms the header of a file has, by the kind of area it is of */
function getZoomsOfFile(fileName: string): { minZoom: number, maxZoom: number } {
    if (fileName.includes(`+${OfflineAreasService.ROOT_ID}.`)) {
        return ROOT_ZOOMS;
    }
    return /\+\d+-\d+\./.test(fileName) ? { minZoom: 7, maxZoom: 14 } : { minZoom: 5, maxZoom: 14 };
}

describe("OfflineFilesDownloadService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([OfflineReducer, InMemoryReducer]),
                { provide: ResourcesService, useValue: { recommendOfflineDownload: "recommend-offline-download" } },
                {
                    provide: FileService, useValue: {
                        writeStyle: vi.fn(() => Promise.resolve()),
                        getStyleJsonContent: vi.fn(() => Promise.resolve(JSON.stringify(createStyle({})))),
                        getStyleJsonContentFromDevice: vi.fn(() => Promise.resolve(JSON.stringify(createStyle({})))),
                        downloadFileToCacheAuthenticated: vi.fn(() => Promise.resolve()),
                        moveFileFromCacheToDataDirectory: vi.fn(() => Promise.resolve()),
                        deleteFileInDataDirectory: vi.fn(() => Promise.resolve()),
                        renameFileInDataDirectory: vi.fn(() => Promise.resolve()),
                        listOfflineFilesInDataDirectory: vi.fn(() => Promise.resolve([MAP_FILE, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })))),
                        listFilesInOfflineCache: vi.fn(() => Promise.resolve([] as string[])),
                        clearOfflineCache: vi.fn(() => Promise.resolve())
                    }
                },
                { provide: LoggingService, useValue: { info: vi.fn(), debug: vi.fn(), warning: vi.fn(), error: vi.fn(), getErrorTypeAndMessage: () => ({ type: "client", message: "" }) } },
                { provide: ToastService, useValue: { confirm: vi.fn() } },
                {
                    provide: PmTilesService, useValue: {
                        getVersion: vi.fn((): Promise<string> => Promise.resolve(undefined)),
                        getZooms: vi.fn((fileName: string) => Promise.resolve(getZoomsOfFile(fileName))),
                        invalidateFile: vi.fn()
                    }
                },
                {
                    provide: RoutingProvider, useValue: {
                        updateOfflineRoutingProfiles: vi.fn(() => Promise.resolve()),
                        extractOfflineRoutingTiles: vi.fn(() => Promise.resolve()),
                        deleteOfflineRoutingTiles: vi.fn(() => Promise.resolve()),
                        getAreasWithRoutingTiles: vi.fn(() => Promise.resolve([TILE_ID]))
                    }
                },
                { provide: RunningContextService, useValue: { isCapacitor: true } },
                {
                    provide: OfflineAreasService, useValue: createOfflineAreasService()
                },
                { provide: Router, useValue: { navigate: vi.fn() } },
                OfflineFilesDownloadService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should clear the offline files cache and read the files of the device into the state, keyed by the tile they belong to",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, "raster-dem+76-51.pmtiles", ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));

                await initialize(service, mockBackend, store, {});

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(downloadedAreas[TILE_ID]?.files.map(f => f.fileName)).toEqual([MAP_FILE, "raster-dem+76-51.pmtiles"]);
                expect(downloadedAreas[TILE_ID]?.files[0].date).toBe(DOWNLOAD_DATE.toISOString());
                expect(downloadedAreas[ROOT_ID]?.files.map(f => f.fileName)).toEqual([ROOT_MAP_FILE]);
                expect(fileService.clearOfflineCache).toHaveBeenCalled();
            }
        )
    );

    it("Should consider a tile compatible when the styles do not require any version, without reading any version",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                await initialize(service, mockBackend, store, {});

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("compatible");
                expect(pmTilesService.getVersion).not.toHaveBeenCalled();
            }
        )
    );

    it("Should consider a tile incompatible when a file is older than the version required by the source it belongs to",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                const versionTheStyleRequires = "3";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { IHM: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider a tile compatible when a file is newer than the version required by the source it belongs to",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                const versionTheStyleRequires = "1";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { IHM: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("compatible");
            }
        )
    );

    it("Should consider a tile incompatible when the required version is written using the name of the file",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                const versionTheStyleRequires = "3";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { "IHM-schema": versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider a tile incompatible when the required version is written using a different case",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                const versionTheStyleRequires = "3";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { ihm: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider the root files, which have a zoom suffix instead of a tile one, incompatible when they are older than the version the style requires",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                const versionTheStyleRequires = "3";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { IHM: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(ROOT_ID, downloadedAreas[ROOT_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider the root files, which have a zoom suffix instead of a tile one, compatible when they are new enough for the style",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                const versionTheStyleRequires = "1";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { IHM: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(ROOT_ID, downloadedAreas[ROOT_ID]?.files)).toBe("compatible");
            }
        )
    );

    it("Should compare versions numerically, so that a file at 1.10 is newer than the required 1.9",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "1.10";
                const versionTheStyleRequires = "1.9";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { IHM: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("compatible");
            }
        )
    );

    it("Should compare versions numerically, so that a file at 1.8 is older than the required 1.9",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "1.8";
                const versionTheStyleRequires = "1.9";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                await initialize(service, mockBackend, store, { IHM: versionTheStyleRequires });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider a tile incompatible when only one of the two styles requires a version the file is not at",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                const fileVersion = "2";
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(fileVersion);

                // The hiking style is happy with the version the file is at, the bicycle one needs a newer file
                await initialize(service, mockBackend, store, { IHM: fileVersion }, { "IHM-schema": "3" });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider a file that has no version incompatible when the style requires one",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(undefined); // The file holds no version
                await initialize(service, mockBackend, store, { IHM: "2" }); // The style requires 2

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider a tile compatible when the version is required from a source that is not in the style",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2");

                // Version 3 is required from a source that no style has, so it is required from no file
                await initialize(service, mockBackend, store, { "a-source-that-does-not-exist": "3" });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("compatible");
            }
        )
    );

    it("Should consider a tile that holds a file of a source the styles no longer use incompatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store) => {
                await initialize(service, mockBackend, store, {});

                // The source was renamed, so what the tile holds is of a source the styles know nothing of
                expect(service.getAreaCompatibility(TILE_ID, [{ fileName: "mapeak-schema+76-51.pmtiles", date: "2026-01-01" }]))
                    .not.toBe("compatible");
            }
        )
    );

    it("Should consider a tile that has no file of a source the styles use incompatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store) => {
                await initialize(service, mockBackend, store, {});

                // The device holds IHM-schema files for tiles, so a tile without one can not be drawn
                expect(service.getAreaCompatibility(TILE_ID, [{ fileName: "raster-dem+76-51.pmtiles", date: "2026-01-01" }]))
                    .not.toBe("compatible");
            }
        )
    );

    it("Should not expect the root files to hold a source that is only downloaded for tiles",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, "raster-dem+76-51.pmtiles", ROOT_MAP_FILE].map(
                        fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));

                await initialize(service, mockBackend, store, {});

                // raster-dem has tile files but no root file of its own, so the root is not missing anything
                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(ROOT_ID, downloadedAreas[ROOT_ID]?.files)).toBe("compatible");
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("compatible");
            }
        )
    );

    it("Should consider a tile that is new enough for every style compatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2

                await initialize(service, mockBackend, store, { IHM: "2" }); // Both styles require 2

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("compatible");
            }
        )
    );

    it("Should consider a tile that only the style that was downloaded now asks more of outdated",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2

                // The style on the device requires nothing, the one that was downloaded now requires 3
                await initialize(service, mockBackend, store, { IHM: "3" });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("outdated");
            }
        )
    );

    it("Should consider a tile that the styles on the device already ask more of unusable",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2
                // The styles that are already on the device require 3, so the map is drawn wrong right now
                vi.mocked(fileService.getStyleJsonContentFromDevice).mockResolvedValue(JSON.stringify(createStyle({ IHM: "3" })));

                await initialize(service, mockBackend, store, { IHM: "3" });

                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(service.getAreaCompatibility(TILE_ID, downloadedAreas[TILE_ID]?.files)).toBe("unusable");
            }
        )
    );

    it("Should consider a tile without routing tiles outdated, since its map is still drawn, but not the root files",
        inject([OfflineFilesDownloadService, HttpTestingController, Store],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store) => {
                await initialize(service, mockBackend, store, {});
                store.reset({ inMemoryState: { downloadedAreas: {} } });

                expect(service.getAreaCompatibility(TILE_ID, [{ fileName: MAP_FILE, date: "2026-01-01" }])).toBe("outdated");
                expect(service.getAreaCompatibility(ROOT_ID, [{ fileName: ROOT_MAP_FILE, date: "2026-01-01" }])).toBe("compatible");
            }
        )
    );

    it("Should tell that everything is up to date when downloading an area that was just downloaded, asking by the date of its files",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, RoutingProvider],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                routingProvider: RoutingProvider) => {
                const downloadDate = new Date();
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue([AREA_MAP_FILE, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: downloadDate, size: FILE_SIZE })));
                vi.mocked(routingProvider.getAreasWithRoutingTiles).mockResolvedValue([AREA_ID]);
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                const request = await flushFilesToDownload(mockBackend, {});

                expect(await promise).toBe("up-to-date");
                expect(request.request.params.get("lastModified")).toBe(downloadDate.toISOString());
                expect(request.request.params.get("routingTar")).toBe("true");
            }
        )
    );

    it("Should move the files that were downloaded, read them into the state and store the routing tiles on their own",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, RoutingProvider],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService, routingProvider: RoutingProvider) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory)
                    .mockResolvedValueOnce([`raster-dem+${AREA_ID}.pmtiles`].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })))
                    .mockResolvedValue([`raster-dem+${AREA_ID}.pmtiles`, AREA_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                vi.mocked(routingProvider.getAreasWithRoutingTiles).mockResolvedValueOnce([]).mockResolvedValue([AREA_ID]);
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [AREA_MAP_FILE]: "2026-06-01", [AREA_ROUTING_TILES_FILE]: "2026-06-01" });

                expect(await promise).toBe("downloaded");
                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(downloadedAreas[AREA_ID]?.files.map(f => f.fileName)).toEqual([`raster-dem+${AREA_ID}.pmtiles`, AREA_MAP_FILE]);
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(AREA_MAP_FILE);
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(AREA_ROUTING_TILES_FILE);
                expect(routingProvider.extractOfflineRoutingTiles).toHaveBeenCalledWith(AREA_ROUTING_TILES_FILE, AREA_ID);
                expect(store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[AREA_ID].hasRoutingTiles).toBe(true);
            }
        )
    );

    it("Should finish a download whose routing tiles could not be handed over and remove the file holding them",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, RoutingProvider],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService, routingProvider: RoutingProvider) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory)
                    .mockResolvedValueOnce([])
                    .mockResolvedValue([AREA_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                vi.mocked(routingProvider.getAreasWithRoutingTiles).mockResolvedValue([]);
                vi.mocked(routingProvider.extractOfflineRoutingTiles).mockRejectedValue(new Error("Not implemented"));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [AREA_MAP_FILE]: "2026-06-01", [AREA_ROUTING_TILES_FILE]: "2026-06-01" });

                expect(await promise).toBe("downloaded");
                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(downloadedAreas[AREA_ID]?.files.map(f => f.fileName)).toEqual([AREA_MAP_FILE]);
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(AREA_ROUTING_TILES_FILE);
            }
        )
    );

    it("Should report a download that was aborted while its files were being downloaded as aborted",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });
                // Aborting a download makes the request of every file that is being downloaded fail
                vi.mocked(fileService.downloadFileToCacheAuthenticated).mockImplementation(() => {
                    service.abortCurrentDownload();
                    return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [AREA_MAP_FILE]: "2026-06-01" });

                expect(await promise).toBe("aborted");
                expect(fileService.moveFileFromCacheToDataDirectory).not.toHaveBeenCalled();
            }
        )
    );

    it("Should keep the download that was started after an abort, even when the aborted one is still unwinding",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });
                const stuckDownloads: (() => void)[] = [];
                const progressCallbacks: FileDownloadProgressCallback[] = [];
                vi.mocked(fileService.downloadFileToCacheAuthenticated).mockImplementation(
                    (_url, _fileName, _token, progressCallback) => {
                        progressCallbacks.push(progressCallback);
                        return new Promise(resolve => stuckDownloads.push(resolve));
                    });

                const stuckPromise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [AREA_MAP_FILE]: "2026-06-01" });
                await vi.waitFor(() => expect(stuckDownloads.length).toBe(1));

                service.abortCurrentDownload();
                const secondPromise = service.downloadArea(OTHER_AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [`IHM-schema+${OTHER_AREA.properties.id}.pmtiles`]: "2026-06-01" }, OTHER_AREA.properties.id);
                await vi.waitFor(() => expect(stuckDownloads.length).toBe(2));

                // The download that was aborted reports its progress before it returns, which is not the progress of the one going on
                progressCallbacks[0](0.5);
                expect(service.downloadInProgress()).toEqual({ area: OTHER_AREA, progress: 0 });

                stuckDownloads[0](); // the download that was stuck finally returns
                expect(await stuckPromise).toBe("aborted");
                expect(service.downloadInProgress()).toEqual({ area: OTHER_AREA, progress: 0 });

                progressCallbacks[1](0.5);
                expect(service.downloadInProgress()).toEqual({ area: OTHER_AREA, progress: 50 });

                stuckDownloads[1]();
                expect(await secondPromise).toBe("downloaded");
                expect(service.downloadInProgress()).toBeNull();
            }
        )
    );

    it("Should ask for the files of an area along with the root files in one request, download each from where it is served, and keep the area after them",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                offlineAreasService: OfflineAreasService) => {
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });
                const area: OfflineArea = {
                    type: "Feature",
                    properties: { id: "israel-and-palestine", name: "Israel – Palestinian Territories" },
                    geometry: { type: "Polygon", coordinates: [[[34, 29], [36, 29], [36, 34], [34, 34], [34, 29]]] }
                };
                const areaFile = "IHM-schema+israel-and-palestine.pmtiles";

                const promise = service.downloadArea(area, []);
                await flushStyles(mockBackend, {});
                const areaRequest = await vi.waitFor(() => mockBackend.expectOne(r => r.url === `${Urls.offlineArea}/israel-and-palestine`));
                expect(service.downloadInProgress()).toEqual({ area, progress: 0 });
                areaRequest.flush({ [areaFile]: "2026-06-01", [ROOT_MAP_FILE]: "2026-06-01" });

                expect(await promise).toBe("downloaded");
                expect(areaRequest.request.method).toBe("GET");
                expect(fileService.downloadFileToCacheAuthenticated).toHaveBeenCalledWith(
                    `${Urls.offlineArea}/israel-and-palestine/${areaFile}`, areaFile, "token", expect.any(Function), expect.any(AbortController));
                expect(fileService.downloadFileToCacheAuthenticated).toHaveBeenCalledWith(
                    `${Urls.offlineArea}/israel-and-palestine/${ROOT_MAP_FILE}`, ROOT_MAP_FILE, "token", expect.any(Function), expect.any(AbortController));
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(areaFile);
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(ROOT_MAP_FILE);
                expect(offlineAreasService.saveAreaMetadata).toHaveBeenCalledWith(area, { minZoom: 5, maxZoom: 14 });
                expect(offlineAreasService.saveAreaMetadata).toHaveBeenCalledWith(OfflineAreasService.createRootArea(), ROOT_ZOOMS);
                expect(vi.mocked(offlineAreasService.saveAreaMetadata).mock.invocationCallOrder[0])
                    .toBeGreaterThan(vi.mocked(fileService.moveFileFromCacheToDataDirectory).mock.invocationCallOrder[0]);
            }
        )
    );

    it("Should replace the old tiles and the areas that are no longer offered an area overlaps, and keep an offered area inside it",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                offlineAreasService: OfflineAreasService) => {
                const farTileFile = "IHM-schema+10-10.pmtiles";
                const oldAreaFile = "IHM-schema+old-israel.pmtiles";
                const innerAreaFile = "IHM-schema+jerusalem.pmtiles";
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, farTileFile, oldAreaFile, innerAreaFile, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                await offlineAreasService.saveAreaMetadata(TILE_AREA, {});
                await offlineAreasService.saveAreaMetadata({ ...TILE_AREA, properties: { id: "10-10" }, geometry: SpatialHelper.getTilePolygon({ x: 10, y: 10 }, 7) }, {});
                await offlineAreasService.saveAreaMetadata(createSquareArea("old-israel", [34, 29, 36, 34]), {});
                await offlineAreasService.saveAreaMetadata(createSquareArea("jerusalem", [35, 31.5, 35.5, 32]), {});
                await initialize(service, mockBackend, store, {});
                const area = createSquareArea("israel-and-palestine", [34, 29, 36, 34]);

                const replacedAreaIds = service.getReplacedAreaIds(area, new Set(["israel-and-palestine", "jerusalem"]));
                const promise = service.downloadArea(area, replacedAreaIds);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { "IHM-schema+israel-and-palestine.pmtiles": "2026-06-01" }, "israel-and-palestine");

                expect(replacedAreaIds.sort()).toEqual([TILE_ID, "old-israel"].sort());
                expect(await promise).toBe("downloaded");
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(MAP_FILE);
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(oldAreaFile);
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith(farTileFile);
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith(innerAreaFile);
            }
        )
    );

    it("Should replace only the old tiles when the areas the server offers are not known",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                offlineAreasService: OfflineAreasService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, "IHM-schema+old-israel.pmtiles", ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                await offlineAreasService.saveAreaMetadata(TILE_AREA, {});
                await offlineAreasService.saveAreaMetadata(createSquareArea("old-israel", [34, 29, 36, 34]), {});
                await initialize(service, mockBackend, store, {});

                expect(service.getReplacedAreaIds(createSquareArea("israel-and-palestine", [34, 29, 36, 34]), new Set())).toEqual([TILE_ID]);
            }
        )
    );

    it("Should save the area it downloads again, so that its polygon is the one it was downloaded with now",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                offlineAreasService: OfflineAreasService) => {
                const namedArea: OfflineArea = { ...AREA, properties: { id: AREA_ID, name: "My area" } };
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [AREA_MAP_FILE, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });
                vi.mocked(offlineAreasService.loadAreasMetadata).mockResolvedValue({ [AREA_ID]: namedArea, [ROOT_ID]: OfflineAreasService.createRootArea(ROOT_ZOOMS) });

                const promise = service.downloadArea(namedArea, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [AREA_MAP_FILE]: "2026-06-01" });

                expect(await promise).toBe("downloaded");
                expect(offlineAreasService.saveAreaMetadata).toHaveBeenCalledWith(namedArea, { minZoom: 5, maxZoom: 14 });
            }
        )
    );

    it("Should rename the files of the tiles and the root files that were downloaded before areas, and keep each of them as an area of the zooms its files hold",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, OfflineAreasService, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                offlineAreasService: OfflineAreasService, pmTilesService: PmTilesService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory)
                    .mockResolvedValueOnce([SERVER_MAP_FILE, "IHM-schema-6.pmtiles"].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })))
                    .mockResolvedValue([MAP_FILE, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                vi.mocked(pmTilesService.getZooms).mockImplementation(fileName =>
                    Promise.resolve(fileName === ROOT_MAP_FILE ? { minZoom: 0, maxZoom: 6 } : getZoomsOfFile(fileName)));

                await initialize(service, mockBackend, store, {});

                expect(fileService.renameFileInDataDirectory).toHaveBeenCalledTimes(2);
                expect(fileService.renameFileInDataDirectory).toHaveBeenCalledWith(SERVER_MAP_FILE, MAP_FILE);
                expect(fileService.renameFileInDataDirectory).toHaveBeenCalledWith("IHM-schema-6.pmtiles", ROOT_MAP_FILE);
                expect(offlineAreasService.saveAreaMetadata).toHaveBeenCalledTimes(2);
                expect(offlineAreasService.saveAreaMetadata).toHaveBeenCalledWith(TILE_AREA, { minZoom: 7, maxZoom: 14 });
                expect(offlineAreasService.saveAreaMetadata).toHaveBeenCalledWith(OfflineAreasService.createRootArea(), { minZoom: 0, maxZoom: 6 });
                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(downloadedAreas[TILE_ID]?.files.map(f => f.fileName)).toEqual([MAP_FILE]);
            }
        )
    );

    it("Should not keep a tile that is already kept as an area again, which would drop the name the user gave it",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, offlineAreasService: OfflineAreasService) => {
                vi.mocked(offlineAreasService.loadAreasMetadata).mockResolvedValue({
                    [TILE_ID]: { ...TILE_AREA, properties: { id: TILE_ID, name: "My tile" } },
                    [ROOT_ID]: OfflineAreasService.createRootArea(ROOT_ZOOMS)
                });

                await initialize(service, mockBackend, store, {});

                expect(offlineAreasService.saveAreaMetadata).not.toHaveBeenCalled();
            }
        )
    );

    it("Should not download again a file that is already in the cache from a download that did not finish",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });
                vi.mocked(fileService.listFilesInOfflineCache).mockResolvedValue([AREA_MAP_FILE]);

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, { [AREA_MAP_FILE]: "2026-06-01", [AREA_ROUTING_TILES_FILE]: "2026-06-01" });

                expect(await promise).toBe("downloaded");
                expect(fileService.downloadFileToCacheAuthenticated).toHaveBeenCalledTimes(1);
                expect(fileService.downloadFileToCacheAuthenticated).toHaveBeenCalledWith(
                    expect.stringContaining(AREA_ROUTING_TILES_FILE), AREA_ROUTING_TILES_FILE, "token", expect.any(Function), expect.any(AbortController));
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(AREA_MAP_FILE);
            }
        )
    );

    it("Should ask for every file of an area that can not be used instead of only for what changed since",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                // The tile holds a file of a source the styles do not use, so it can not be drawn as it is
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [`a-removed-source+${AREA_ID}.pmtiles`, ROOT_MAP_FILE].map(
                        fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                const tileRequest = await flushFilesToDownload(mockBackend, {});
                await promise;

                // Asking only for what changed would have the server answer that there is nothing to download
                expect(tileRequest.request.params.has("lastModified")).toBe(false);
                expect(tileRequest.request.params.get("routingTar")).toBe("true");
            }
        )
    );

    it("Should delete the root files of an unused source even while a tile still holds files of it",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue([
                    AREA_MAP_FILE,
                    `a-removed-source+${AREA_ID}.pmtiles`,
                    "a-removed-source+75-50.pmtiles",
                    "a-removed-source+root.pmtiles"
                ].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, {});
                await promise;

                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(`a-removed-source+${AREA_ID}.pmtiles`);
                // 75-50 was not asked for, so it is left with what it has and goes on being an area the user has
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith("a-removed-source+75-50.pmtiles");
                // The styles on the device are the ones that were just downloaded, so 75-50 can not be drawn
                // from that source either way and nothing is left that the root file could serve
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("a-removed-source+root.pmtiles");
            }
        )
    );

    it("Should delete the files of sources that the styles no longer use when an area is downloaded",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue([
                    AREA_MAP_FILE,
                    `global_points+${AREA_ID}.pmtiles`,
                    `a-removed-source+${AREA_ID}.pmtiles`,
                    "a-removed-source+root.pmtiles"
                ].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedAreas: {} }
                });

                const promise = service.downloadArea(AREA, []);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, {});

                expect(await promise).toBe("up-to-date");
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(`a-removed-source+${AREA_ID}.pmtiles`);
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("a-removed-source+root.pmtiles");
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith(AREA_MAP_FILE);
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith(`global_points+${AREA_ID}.pmtiles`);
            }
        )
    );

    it("Should delete the files, the routing tiles and the area of a tile, and read what is left from the device",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, RoutingProvider, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService, routingProvider: RoutingProvider, offlineAreasService: OfflineAreasService) => {
                await initialize(service, mockBackend, store, {});
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue([ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                vi.mocked(routingProvider.getAreasWithRoutingTiles).mockResolvedValue([]);

                await service.deleteArea(TILE_ID);

                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(MAP_FILE);
                expect(routingProvider.deleteOfflineRoutingTiles).toHaveBeenCalledWith(TILE_ID);
                expect(offlineAreasService.deleteAreaMetadata).toHaveBeenCalledWith(TILE_ID);
                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(downloadedAreas[TILE_ID]?.files).toBeUndefined();
            }
        )
    );

    it("Should keep the root files while an area still uses them after a tile is deleted",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, OfflineAreasService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService,
                offlineAreasService: OfflineAreasService) => {
                const areaFile = "IHM-schema+israel-and-palestine.pmtiles";
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, ROOT_MAP_FILE, areaFile].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                await initialize(service, mockBackend, store, {});

                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue(
                    [ROOT_MAP_FILE, areaFile].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                await service.deleteArea(TILE_ID);

                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith(ROOT_MAP_FILE);
                expect(offlineAreasService.deleteAreaMetadata).not.toHaveBeenCalledWith(ROOT_ID);
            }
        )
    );

    it("Should read what the device holds even when the routing tiles of a tile could not be removed",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, RoutingProvider],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService, routingProvider: RoutingProvider) => {
                await initialize(service, mockBackend, store, {});
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue([ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                vi.mocked(routingProvider.getAreasWithRoutingTiles).mockResolvedValue([]);
                vi.mocked(routingProvider.deleteOfflineRoutingTiles).mockRejectedValue(new Error("Not implemented"));

                await service.deleteArea(TILE_ID);

                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(MAP_FILE);
                const downloadedAreas = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
                expect(downloadedAreas[TILE_ID]?.files).toBeUndefined();
            }
        )
    );

    it("Should recommend to download again when a downloaded tile is not compatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, ToastService, FileService, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                toastService: ToastService, fileService: FileService, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2

                await initialize(service, mockBackend, store, { IHM: "3" }); // The style requires 3

                expect(toastService.confirm).toHaveBeenCalled();
                expect(fileService.writeStyle).not.toHaveBeenCalled();
            }
        )
    );

    it("Should store the styles and not recommend to download again when the downloaded tiles are compatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, ToastService, FileService, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                toastService: ToastService, fileService: FileService, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2

                await initialize(service, mockBackend, store, { IHM: "2" }); // The style requires 2

                expect(toastService.confirm).not.toHaveBeenCalled();
                expect(fileService.writeStyle).toHaveBeenCalledTimes(2);
            }
        )
    );

    it("Should recommend downloading when the device holds no offline files",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, ToastService, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                toastService: ToastService, fileService: FileService) => {
                vi.mocked(fileService.listOfflineFilesInDataDirectory).mockResolvedValue([]);

                await initialize(service, mockBackend, store, {});

                expect(toastService.confirm).toHaveBeenCalled();
            }
        )
    );
});
