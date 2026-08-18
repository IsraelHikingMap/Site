import { describe, beforeEach, vi, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { Router } from "@angular/router";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";

import { OfflineFilesDownloadService } from "./offline-files-download.service";
import { OfflineReducer } from "../reducers/offline.reducer";
import { InMemoryReducer } from "../reducers/in-memory.reducer";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { PmTilesService } from "./pmtiles.service";
import { RunningContextService } from "./running-context.service";
import { Urls } from "../urls";
import type { ApplicationState } from "../models";

const ROOT_TILE_KEY = PmTilesService.toTileKey();
const TILE_KEY = PmTilesService.toTileKey(76, 51);
const MAP_FILE = "IHM-schema+7-76-51.pmtiles";
const ROOT_MAP_FILE = "IHM-schema-6.pmtiles";
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
            "DEM": { type: "raster-dem", url: "https://global.israelhikingmap.workers.dev/raster-dem.json" }
        },
        layers: [] as object[]
    };
}

/**
 * Runs the initialization, which reads the files of the device into the state and the versions the
 * styles require.
 */
async function initialize(service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
    hikeMinVersions: MinVersions, bikeMinVersions: MinVersions = {}) {
    store.reset({
        userState: { token: "token" },
        offlineState: { isSubscribed: true },
        inMemoryState: { downloadedTiles: {} }
    });
    const promise = service.initialize();
    await flushStyles(mockBackend, hikeMinVersions, bikeMinVersions);
    await promise;
}

async function flushStyles(mockBackend: HttpTestingController, hikeMinVersions: MinVersions, bikeMinVersions: MinVersions = {}) {
    for (const [url, minVersions] of [[Urls.HIKING_STYLE_ADDRESS, hikeMinVersions], [Urls.MTB_STYLE_ADDRESS, bikeMinVersions]] as [string, MinVersions][]) {
        await new Promise(resolve => setTimeout(resolve));
        mockBackend.expectOne(url).flush(JSON.stringify(createStyle(minVersions)));
    }
}

/** Answers the request for the list of files that need to be downloaded, for the root files or for a tile */
async function flushFilesToDownload(mockBackend: HttpTestingController, forTile: boolean, files: Record<string, string>): Promise<TestRequest> {
    await new Promise(resolve => setTimeout(resolve));
    const request = mockBackend.expectOne(r => r.url === Urls.offlineFiles && r.params.has("tileX") === forTile);
    request.flush(files);
    return request;
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
                        downloadFileToCacheAuthenticated: vi.fn(() => Promise.resolve()),
                        moveFileFromCacheToDataDirectory: vi.fn(() => Promise.resolve()),
                        deleteFileInDataDirectory: vi.fn(() => Promise.resolve()),
                        listFilesInDataDirectory: vi.fn(() => Promise.resolve([MAP_FILE, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })))),
                        listFilesInOfflineCache: vi.fn(() => Promise.resolve([] as string[])),
                        clearOfflineCache: vi.fn(() => Promise.resolve())
                    }
                },
                { provide: LoggingService, useValue: { info: vi.fn(), debug: vi.fn(), warning: vi.fn(), error: vi.fn(), getErrorTypeAndMessage: () => ({ type: "client", message: "" }) } },
                { provide: ToastService, useValue: { confirm: vi.fn() } },
                { provide: PmTilesService, useValue: { getVersion: vi.fn((): Promise<string> => Promise.resolve(undefined)), invalidateFile: vi.fn() } },
                { provide: RunningContextService, useValue: { isCapacitor: true } },
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
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, "raster-dem+7-76-51.pmtiles", ROOT_MAP_FILE, "mapeak-hike.json"].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));

                await initialize(service, mockBackend, store, {});

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(downloadedTiles[TILE_KEY].map(f => f.fileName)).toEqual([MAP_FILE, "raster-dem+7-76-51.pmtiles"]);
                expect(downloadedTiles[TILE_KEY][0].date).toBe(DOWNLOAD_DATE.toISOString());
                expect(downloadedTiles[ROOT_TILE_KEY].map(f => f.fileName)).toEqual([ROOT_MAP_FILE]);
                expect(fileService.clearOfflineCache).toHaveBeenCalled();
            }
        )
    );

    it("Should consider a tile compatible when the styles do not require any version, without reading any version",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                await initialize(service, mockBackend, store, {});

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("compatible");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("compatible");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(ROOT_TILE_KEY, downloadedTiles[ROOT_TILE_KEY])).toBe("outdated");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(ROOT_TILE_KEY, downloadedTiles[ROOT_TILE_KEY])).toBe("compatible");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("compatible");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
            }
        )
    );

    it("Should consider a file that has no version incompatible when the style requires one",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue(undefined); // The file holds no version
                await initialize(service, mockBackend, store, { IHM: "2" }); // The style requires 2

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
            }
        )
    );

    it("Should consider a tile compatible when the version is required from a source that is not in the style",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2");

                // Version 3 is required from a source that no style has, so it is required from no file
                await initialize(service, mockBackend, store, { "a-source-that-does-not-exist": "3" });

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("compatible");
            }
        )
    );

    it("Should consider a tile that holds a file of a source the styles no longer use incompatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store) => {
                await initialize(service, mockBackend, store, {});

                // The source was renamed, so what the tile holds is of a source the styles know nothing of
                expect(service.getTileCompatibility(TILE_KEY, [{ fileName: "mapeak-schema+7-76-51.pmtiles", date: "2026-01-01" }]))
                    .not.toBe("compatible");
            }
        )
    );

    it("Should consider a tile that has no file of a source the styles use incompatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store) => {
                await initialize(service, mockBackend, store, {});

                // The device holds IHM-schema files for tiles, so a tile without one can not be drawn
                expect(service.getTileCompatibility(TILE_KEY, [{ fileName: "raster-dem+7-76-51.pmtiles", date: "2026-01-01" }]))
                    .not.toBe("compatible");
            }
        )
    );

    it("Should not expect the root files to hold a source that is only downloaded for tiles",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService) => {
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue(
                    [MAP_FILE, "raster-dem+7-76-51.pmtiles", ROOT_MAP_FILE].map(
                        fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));

                await initialize(service, mockBackend, store, {});

                // raster-dem has tile files but no root file of its own, so the root is not missing anything
                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(ROOT_TILE_KEY, downloadedTiles[ROOT_TILE_KEY])).toBe("compatible");
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("compatible");
            }
        )
    );

    it("Should consider a tile that is new enough for every style compatible",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2

                await initialize(service, mockBackend, store, { IHM: "2" }); // Both styles require 2

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("compatible");
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

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("outdated");
            }
        )
    );

    it("Should consider a tile that the styles on the device already ask more of unusable",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService, PmTilesService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService, pmTilesService: PmTilesService) => {
                vi.mocked(pmTilesService.getVersion).mockResolvedValue("2"); // The files are at version 2
                // The styles that are already on the device require 3, so the map is drawn wrong right now
                vi.mocked(fileService.getStyleJsonContent).mockResolvedValue(JSON.stringify(createStyle({ IHM: "3" })));

                await initialize(service, mockBackend, store, { IHM: "3" });

                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(service.getTileCompatibility(TILE_KEY, downloadedTiles[TILE_KEY])).toBe("unusable");
            }
        )
    );

    it("Should tell that everything is up to date when downloading a tile that was just downloaded",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                const downloadDate = new Date();
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue([MAP_FILE, ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: downloadDate, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                const rootRequest = await flushFilesToDownload(mockBackend, false, {});
                const tileRequest = await flushFilesToDownload(mockBackend, true, {});

                expect(await promise).toBe("up-to-date");
                expect(rootRequest.request.params.get("lastModified")).toBe(downloadDate.toISOString());
                expect(tileRequest.request.params.get("lastModified")).toBe(downloadDate.toISOString());
            }
        )
    );

    it("Should move the files that were downloaded and read them into the state",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService) => {
                vi.mocked(fileService.listFilesInDataDirectory)
                    .mockResolvedValueOnce(["raster-dem+7-76-51.pmtiles"].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })))
                    .mockResolvedValue(["raster-dem+7-76-51.pmtiles", MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, { [MAP_FILE]: "2026-06-01" });

                expect(await promise).toBe("downloaded");
                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(downloadedTiles[TILE_KEY].map(f => f.fileName)).toEqual(["raster-dem+7-76-51.pmtiles", MAP_FILE]);
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(MAP_FILE);
            }
        )
    );

    it("Should report a download that was aborted while its files were being downloaded as aborted",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });
                // Aborting a download makes the request of every file that is being downloaded fail
                vi.mocked(fileService.downloadFileToCacheAuthenticated).mockImplementation(() => {
                    service.abortCurrentDownload();
                    return Promise.reject(new DOMException("The user aborted a request.", "AbortError"));
                });

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, { [MAP_FILE]: "2026-06-01" });

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
                    inMemoryState: { downloadedTiles: {} }
                });
                const stuckDownloads: (() => void)[] = [];
                const progressCallbacks: ((value: number) => void)[] = [];
                vi.mocked(fileService.downloadFileToCacheAuthenticated).mockImplementation(
                    (_url, _fileName, _token, progressCallback) => {
                        progressCallbacks.push(progressCallback);
                        return new Promise(resolve => stuckDownloads.push(resolve));
                    });

                const stuckPromise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, { [MAP_FILE]: "2026-06-01" });
                await new Promise(resolve => setTimeout(resolve));
                expect(stuckDownloads.length).toBe(1);

                service.abortCurrentDownload();
                const secondPromise = service.downloadTile(76, 52);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, { "IHM-schema+7-76-52.pmtiles": "2026-06-01" });
                await new Promise(resolve => setTimeout(resolve));

                // The download that was aborted reports its progress before it returns, which is not the progress of the one going on
                progressCallbacks[0](0.5);
                expect(service.currentDownloadedTile()).toEqual({ tileX: 76, tileY: 52, progress: 0 });

                stuckDownloads[0](); // the download that was stuck finally returns
                expect(await stuckPromise).toBe("aborted");
                expect(service.currentDownloadedTile()).toEqual({ tileX: 76, tileY: 52, progress: 0 });

                progressCallbacks[1](0.5);
                expect(service.currentDownloadedTile()).toEqual({ tileX: 76, tileY: 52, progress: 50 });

                stuckDownloads[1]();
                expect(await secondPromise).toBe("downloaded");
                expect(service.currentDownloadedTile()).toBeNull();
            }
        )
    );

    it("Should not download again a file that is already in the cache from a download that did not finish",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });
                vi.mocked(fileService.listFilesInOfflineCache).mockResolvedValue([MAP_FILE]);

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, { [MAP_FILE]: "2026-06-01", "raster-dem+7-76-51.pmtiles": "2026-06-01" });

                expect(await promise).toBe("downloaded");
                expect(fileService.downloadFileToCacheAuthenticated).toHaveBeenCalledTimes(1);
                expect(fileService.downloadFileToCacheAuthenticated).toHaveBeenCalledWith(
                    expect.stringContaining("raster-dem+7-76-51.pmtiles"), "raster-dem+7-76-51.pmtiles", "token", expect.any(Function), expect.any(AbortController));
                expect(fileService.moveFileFromCacheToDataDirectory).toHaveBeenCalledWith(MAP_FILE);
            }
        )
    );

    it("Should ask for every file of a tile that can not be used instead of only for what changed since",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                // The tile holds a file of a source the styles do not use, so it can not be drawn as it is
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue(
                    ["a-removed-source+7-76-51.pmtiles", ROOT_MAP_FILE].map(
                        fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                const tileRequest = await flushFilesToDownload(mockBackend, true, {});
                await promise;

                // Asking only for what changed would have the server answer that there is nothing to download
                expect(tileRequest.request.params.has("lastModified")).toBe(false);
            }
        )
    );

    it("Should only delete the files of unused sources that belong to the tile that is being downloaded",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue([
                    MAP_FILE,
                    "a-removed-source+7-76-51.pmtiles",
                    "a-removed-source+7-75-50.pmtiles",
                    "a-removed-source-6.pmtiles"
                ].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, {});
                await promise;

                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("a-removed-source+7-76-51.pmtiles");
                // 75-50 was not asked for, and it still needs its files and the root files they go with
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith("a-removed-source+7-75-50.pmtiles");
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith("a-removed-source-6.pmtiles");
            }
        )
    );

    it("Should delete the files of sources that the styles no longer use when a tile is downloaded",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store, fileService: FileService) => {
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue([
                    MAP_FILE,
                    "global_points+7-76-51.pmtiles",
                    "a-removed-source+7-76-51.pmtiles",
                    "a-removed-source-6.pmtiles",
                    "mapeak-hike.json"
                ].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));
                store.reset({
                    userState: { token: "token" },
                    offlineState: { isSubscribed: true },
                    inMemoryState: { downloadedTiles: {} }
                });

                const promise = service.downloadTile(76, 51);
                await flushStyles(mockBackend, {});
                await flushFilesToDownload(mockBackend, false, {});
                await flushFilesToDownload(mockBackend, true, {});

                expect(await promise).toBe("up-to-date");
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("a-removed-source+7-76-51.pmtiles");
                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith("a-removed-source-6.pmtiles");
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith(MAP_FILE);
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith("global_points+7-76-51.pmtiles");
                expect(fileService.deleteFileInDataDirectory).not.toHaveBeenCalledWith("mapeak-hike.json");
            }
        )
    );

    it("Should delete the files of a tile and read what is left from the device",
        inject([OfflineFilesDownloadService, HttpTestingController, Store, FileService],
            async (service: OfflineFilesDownloadService, mockBackend: HttpTestingController, store: Store,
                fileService: FileService) => {
                await initialize(service, mockBackend, store, {});
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue([ROOT_MAP_FILE].map(fileName => ({ fileName, modifiedDate: DOWNLOAD_DATE, size: FILE_SIZE })));

                await service.deleteTile(TILE_KEY);

                expect(fileService.deleteFileInDataDirectory).toHaveBeenCalledWith(MAP_FILE);
                const downloadedTiles = store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
                expect(downloadedTiles[TILE_KEY]).toBeUndefined();
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
                vi.mocked(fileService.listFilesInDataDirectory).mockResolvedValue([]);

                await initialize(service, mockBackend, store, {});

                expect(toastService.confirm).toHaveBeenCalled();
            }
        )
    );
});
