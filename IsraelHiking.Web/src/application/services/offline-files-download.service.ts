import { computed, inject, Service, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { last } from "lodash-es";
import { Immutable } from "immer";
import pLimit from "p-limit";
import { booleanIntersects } from "@turf/boolean-intersects";
import type { StyleSpecification } from "maplibre-gl";

import { Urls } from "../urls";
import { FileService, type DataDirectoryFile } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { AREA_MIN_ZOOM, PmTilesService, ROOT_ZOOM, TILES_ZOOM } from "./pmtiles.service";
import { RoutingProvider } from "./routing.provider";
import { RunningContextService } from "./running-context.service";
import { RouteStrings } from "./hash.service";
import { OfflineAreasService } from "./offline-areas.service";
import { SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, DownloadedArea, FileNameDateVersion, OfflineArea } from "../models";

/** What the styles need from the offline files, see readStyleRequirements */
type StyleRequirements = {
    /** The minimal version a source file needs to be at, keyed by the lower cased name of that file */
    minVersionPerFile: Record<string, string>;
    /** The lower cased names of the files of the sources the styles use */
    sourceFileNames: string[];
};

/**
 * How usable the files of a tile still are, see getTileCompatibility. "outdated" only means that a newer
 * style wants more than they hold, while "unusable" means the map is already drawn wrong without them.
 */
export type TileCompatibility = "compatible" | "outdated" | "unusable";

/** The download that is going on right now, everything that lives as long as it does */
type CurrentDownload = {
    /** What is downloaded, an area or a tile, which is an area as well, see OfflineAreasService.createTileArea */
    area: Immutable<OfflineArea>;
    /** How much was downloaded so far, from 0 to 100 */
    progress: number;
    /** Identifies the download - a new one gets a new controller, and only it can abort it */
    abortController: AbortController;
};

/** A file the server lists, named the way it is kept on the device, see getLocalFileName */
type FileToDownload = FileNameDateVersion & {
    /** The name the server serves the file by */
    serverFileName: string;
};

export type DownloadStatus = "up-to-date" | "downloaded" | "error" | "aborted";

@Service()
export class OfflineFilesDownloadService {
    /** The metadata key a style uses to declare the minimal version it needs from one of its sources */
    private static readonly MIN_VERSION_KEY_REGEX = /^sources:(.+):min-version$/;

    /**
     * Sources the app adds by itself instead of taking them from the style, see the public pois component.
     * Their files are downloaded and needed like the files of the style's own sources.
     */
    private static readonly APPLICATION_SOURCE_FILE_NAMES = ["global_points"];

    /** The name the files of a tile were kept under before tiles were kept like areas, "name+7-x-y.pmtiles" */
    private static readonly TILE_FILE_NAME_REGEX = new RegExp(`^(.+)\\+${TILES_ZOOM}-(\\d+-\\d+)(\\.\\w+)$`);
    /** The name the server gives a root file, and the one they were kept under before they were kept like areas, "name-4.pmtiles" */
    private static readonly ROOT_FILE_NAME_REGEX = /^([^+]+)-(\d+)(\.pmtiles)$/;

    private readonly resources = inject(ResourcesService);
    private readonly fileService = inject(FileService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly toastService = inject(ToastService);
    private readonly pmtilesService = inject(PmTilesService);
    private readonly routingProvider = inject(RoutingProvider);
    private readonly runningContextService = inject(RunningContextService);
    private readonly store = inject(Store);
    private readonly router = inject(Router);
    private readonly offlineAreasService = inject(OfflineAreasService);

    /** What the styles that were downloaded now need from the offline files, read every time they are downloaded */
    private onlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    /**
     * What the styles that are already on the device need. They are what the map is drawn with when there
     * is no network, and they are only replaced once every tile can be drawn with them, so a tile that
     * does not meet them is one the app can not draw correctly right now.
     */
    private offlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    private readonly currentDownload = signal<CurrentDownload | null>(null);

    /** The area that is being downloaded right now and how far it got, null when there is no download */
    public readonly downloadInProgress = computed(() => {
        const currentDownload = this.currentDownload();
        return currentDownload == null ? null : { area: currentDownload.area, progress: currentDownload.progress };
    });

    /**
     * Reads what was downloaded into the state, and when there's a reason to, recommends downloading it
     * again. Whoever needs to know what is on the device reacts to the state changing, so there's no need
     * to wait for this before the app is up.
     * The files are read for every user of the app, a user whose subscription ended still has them and
     * should be offered to renew it rather than to buy it, but only the device holds any.
     */
    public async initialize(): Promise<void> {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        await this.fileService.clearOfflineCache();
        await this.migrateToAreas();
        await this.updateDownloadedAreasFromDevice();
        await this.deleteUnusedRootFiles();
        await this.updateOfflineStyleRequirements();
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (userState == null || offlineState.isSubscribed === false) {
            return;
        }
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            await this.updateVersionsOfDownloadedFiles();
            const downloadedAreas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
            const incompatibleTileKeys: string[] = [];
            for (const [tileKey, { files }] of Object.entries(downloadedAreas)) {
                if (tileKey === PmTilesService.LEGACY_ROOT_KEY) {
                    continue;
                }
                const compatibility = this.getTileCompatibility(tileKey, files);
                if (compatibility === "compatible") {
                    continue;
                }
                incompatibleTileKeys.push(tileKey);
                const reason = this.getUnmetRequirement(tileKey, files, this.offlineStyleRequirements)
                    ?? this.getUnmetRequirement(tileKey, files, this.onlineStyleRequirements);
                this.loggingService.info(`[Offline Download] ${tileKey} is ${compatibility}${reason == null ? "" : `: ${reason}`}`);
            }
            if (incompatibleTileKeys.length > 0) {
                this.loggingService.info(`[Offline Download] These tiles need to be downloaded again: ${incompatibleTileKeys.join(", ")}`);
            }
            const needToAskToRedownload = Object.keys(downloadedAreas).length === 0 || incompatibleTileKeys.length > 0;
            if (!needToAskToRedownload) {
                await this.writeStylesToDevice(styles);
                return;
            }
            this.toastService.confirm({
                type: "YesNo",
                message: this.resources.recommendOfflineDownload,
                confirmAction: async () => {
                    this.router.navigate([RouteStrings.ROUTE_OFFLINE_MANAGEMENT]);
                }
            });
        } catch {
            // ignore in case this happens in offline
        }
    }

    /**
     * Stores the styles that were downloaded on the device, which makes them the ones the map is drawn
     * with offline, and reads what they require now that they are the ones in use.
     */
    private async writeStylesToDevice(styles: { fileName: string, content: string }[]): Promise<void> {
        for (const styleAndContent of styles) {
            await this.fileService.writeStyle(styleAndContent.fileName, styleAndContent.content);
        }
        await this.updateOfflineStyleRequirements();
    }

    /**
     * Reads what the styles that are on the device require, so that a tile that can not be drawn with them
     * is told apart from one that only lacks what a newer style asks for. A style that is not on the device
     * reads as empty and requires nothing - without it there is nothing to say the tiles are drawn wrong.
     */
    private async updateOfflineStyleRequirements(): Promise<void> {
        const requirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
        for (const baseLayerUrl of [Urls.HIKING_STYLE_ADDRESS, Urls.MTB_STYLE_ADDRESS]) {
            const content = await this.fileService.getStyleJsonContentFromDevice(baseLayerUrl);
            this.readStyleRequirements(JSON.parse(content) as StyleSpecification, requirements);
        }
        this.offlineStyleRequirements = requirements;
    }

    /**
     * Gets the newest styles, in order to know what they require and to keep the ones on the device
     * up to date. They are taken from where they are published, which is public and needs nothing
     * from this server, and they are stored on the device by whoever asked for them - they are not
     * a part of the offline files the server lists.
     */
    private async downloadStyleAndUpdateMetadata(): Promise<{ fileName: string, content: string }[]> {
        const styles: { fileName: string, content: string }[] = [];
        for (const baseLayerUrl of [Urls.HIKING_STYLE_ADDRESS, Urls.MTB_STYLE_ADDRESS]) {
            const style = await firstValueFrom(this.httpClient.get(baseLayerUrl, { responseType: "text" }).pipe(timeout(10000)));
            styles.push({ fileName: last(baseLayerUrl.split("/")), content: style });
        }
        this.onlineStyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
        for (const style of styles) {
            this.readStyleRequirements(JSON.parse(style.content) as StyleSpecification, this.onlineStyleRequirements);
        }
        return styles;
    }

    /**
     * A style declares the minimal version it needs from a source using a "sources:{name}:min-version" metadata
     * key, but the offline files are named after the file the source's url points to and not after the name of
     * the source in the style - the "IHM" source, for example, is downloaded as "IHM-schema+7-x-y.pmtiles".
     * This translates every such key to the name of the file it refers to, accepting a key that is written using
     * either name, so that a mismatch between the two does not silently skip the version check.
     * When both styles require a version from the same file the stricter one wins.
     */
    private readStyleRequirements(style: StyleSpecification, requirements: StyleRequirements): void {
        const fileNamePerSourceName: Record<string, string> = {};
        for (const [sourceName, source] of Object.entries(style.sources ?? {})) {
            const fileName = OfflineFilesDownloadService.getFileNameFromUrl((source as { url?: string }).url);
            if (fileName != null) {
                fileNamePerSourceName[sourceName.toLowerCase()] = fileName;
            }
        }
        const knownFileNames = Object.values(fileNamePerSourceName).map(f => f.toLowerCase());
        requirements.sourceFileNames = [...new Set([...requirements.sourceFileNames, ...knownFileNames])];
        for (const [key, minVersion] of Object.entries((style.metadata ?? {}) as Record<string, string>)) {
            const name = OfflineFilesDownloadService.MIN_VERSION_KEY_REGEX.exec(key)?.[1];
            if (name == null || !minVersion) {
                continue;
            }
            const fileName = (fileNamePerSourceName[name.toLowerCase()] ?? name).toLowerCase();
            if (!knownFileNames.includes(fileName)) {
                this.loggingService.warning(`[Offline Download] The style requires version ${minVersion} from "${name}", ` +
                    "which is not a source of the style, using it as a file name");
            }
            const currentMinVersion = requirements.minVersionPerFile[fileName];
            if (currentMinVersion == null || OfflineFilesDownloadService.compareVersions(minVersion, currentMinVersion) > 0) {
                requirements.minVersionPerFile[fileName] = minVersion;
            }
        }
    }

    /**
     * The name of the file a source's url points to, without its extension, which is also the name the server
     * gives the offline files of that source: "https://mapeak.com/vector/data/IHM-schema.json" is "IHM-schema".
     */
    private static getFileNameFromUrl(url: string | undefined): string | null {
        const lastPart = last((url ?? "").split("?")[0].split("/"));
        return lastPart ? OfflineFilesDownloadService.removeExtension(lastPart) : null;
    }

    /**
     * The name of the source file an offline file holds: the files of an area look like "name+id.pmtiles" and
     * root files like "name-4.pmtiles", where the name itself may contain a "-".
     */
    private static getSourceFileName(fileName: string): string {
        const plusIndex = fileName.indexOf("+");
        if (plusIndex >= 0) {
            return fileName.substring(0, plusIndex);
        }
        return OfflineFilesDownloadService.removeExtension(fileName).replace(/-\d+$/, "");
    }

    /** The id of the area an offline file is of, taken from its name, "name+id.pmtiles", null for a file that is of none */
    private static getKey(fileName: string): string | null {
        const plusIndex = fileName.indexOf("+");
        return plusIndex < 0 ? null : OfflineFilesDownloadService.removeExtension(fileName.substring(plusIndex + 1));
    }

    /**
     * The name a file is kept under on the device, "name+id.ext" after the id of the area it is of, where a root
     * file is of the root files, see PmTilesService.ROOT_KEY, and a file that is of no area keeps its name.
     */
    private static getLocalFileName(serverFileName: string, key: string): string {
        const plusIndex = serverFileName.indexOf("+");
        if (plusIndex >= 0) {
            return `${serverFileName.substring(0, plusIndex)}+${key}${serverFileName.substring(serverFileName.lastIndexOf("."))}`;
        }
        return serverFileName.replace(OfflineFilesDownloadService.ROOT_FILE_NAME_REGEX, `$1+${PmTilesService.ROOT_KEY}$3`);
    }

    private static removeExtension(fileName: string): string {
        const dotIndex = fileName.lastIndexOf(".");
        return dotIndex > 0 ? fileName.substring(0, dotIndex) : fileName;
    }

    /** Compares two versions numerically, so that "1.10" is newer than "1.9" */
    private static compareVersions(version: string, otherVersion: string): number {
        return version.localeCompare(otherVersion, undefined, { numeric: true, sensitivity: "base" });
    }

    /**
     * Downloads everything an area needs, where a tile is an area as well, see OfflineAreasService.createTileArea.
     * A download that is still going on when this is called is aborted first, so that the one the user asked for
     * last is the only one that goes on.
     * A download that failed is logged with what it failed on rather than with a status code alone: a
     * request that got no answer is the connection and not the server, which is how a download of hundreds
     * of megabytes fails when it drops, and calling that a server side error sends whoever reads the log
     * the wrong way.
     */
    public async downloadArea(area: Immutable<OfflineArea>): Promise<DownloadStatus> {
        this.abortCurrentDownload();
        const currentDownload: CurrentDownload = { area, progress: 0, abortController: new AbortController() };
        this.currentDownload.set(currentDownload);
        const key = area.properties.id;
        this.loggingService.info(`[Offline Download] Starting downloading the offline files of ${key}`);
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            await this.writeStylesToDevice(styles);
            await this.deleteFilesOfUnusedSources(key);
            // What is asked of the server is decided by the state, so it is read again now that files were deleted
            await this.updateDownloadedAreasFromDevice();
            const fileNames = await this.getFilesToDownload(area);
            if (fileNames.length === 0) {
                this.loggingService.info("[Offline Download] No files to download, all files are up to date");
                return "up-to-date";
            }
            await this.downloadOfflineFilesProgressAction(currentDownload, fileNames);

            if (currentDownload.abortController.signal.aborted) {
                return "aborted";
            }

            await this.moveDownloadedFilesToDataDirectory(currentDownload, fileNames);
            await this.keepNewArea(area);
            await this.keepFilesWithoutAnAreaAsAreas();
            for (const tileKey of this.getOverlappedTileKeys(area)) {
                await this.deleteArea(tileKey);
            }
            // The files that were just moved in are what the app has now, with the versions of the new ones
            await this.updateDownloadedAreasFromDevice();
            await this.updateVersionsOfDownloadedFiles();
            return "downloaded";
        } catch (ex) {
            if (currentDownload.abortController.signal.aborted) {
                // Aborting makes whatever was going on at that moment fail, which is not an error
                this.loggingService.info("[Offline Download] The download was aborted while it was going on");
                return "aborted";
            }
            const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
            const reason = typeAndMessage.type === "timeout"
                ? "a timeout"
                : typeAndMessage.statusCode != null
                    ? `the server answering with ${typeAndMessage.statusCode}`
                    : "a request that got no answer, i.e. the connection and not the server";
            this.loggingService.error(`[Offline Download] The download of ${key} failed due to ${reason}: ${typeAndMessage.message}`);
            return "error";
        } finally {
            // A download that was aborted might only get here after the next one started, and it is not its to clear
            if (this.isCurrent(currentDownload)) {
                this.currentDownload.set(null);
            }
        }
    }

    /**
     * Downloads the files into the cache, where a download that was aborted or failed leaves whatever it
     * did get, so that downloading the tile again continues from there instead of starting over.
     * A few files are downloaded at a time, in the order they were listed in, which is why the server
     * lists the files that take it longest first - a file that is started last is the one left downloading
     * on its own once every other file is done.
     * A file that is already whole in the cache is not downloaded again.
     */
    private async downloadOfflineFilesProgressAction(currentDownload: CurrentDownload, fileNames: FileToDownload[]): Promise<void> {
        const { area, abortController } = currentDownload;
        const key = area.properties.id;
        this.loggingService.info(`[Offline Download] Starting downloading offline files, total files: ${fileNames.length}, of: ${key}`);
        const length = fileNames.length;
        const progressPerFile: Record<number, number> = {};
        const alreadyDownloaded = await this.fileService.listFilesInOfflineCache();
        const fileDownloadPromises: Promise<void>[] = [];
        const limit = pLimit(3);
        for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
            const { fileName, serverFileName } = fileNames[fileNameIndex];
            if (abortController.signal.aborted) {
                this.loggingService.info("[Offline Download] Aborted downloading offline files, current file: " + fileName);
                return;
            }
            if (alreadyDownloaded.includes(fileName)) {
                this.loggingService.info("[Offline Download] File already downloaded recently, skipping: " + fileName);
                this.updateProgress(currentDownload, progressPerFile, fileNameIndex, 1, length);
                continue;
            }
            const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
            const fileDownloadUrl = OfflineFilesDownloadService.getFileUrl(area, serverFileName);
            fileDownloadPromises.push(limit(() => this.fileService.downloadFileToCacheAuthenticated(fileDownloadUrl, fileName, token,
                value => this.updateProgress(currentDownload, progressPerFile, fileNameIndex, value, length), abortController)));
        }
        await Promise.all(fileDownloadPromises);
        this.loggingService.info(`[Offline Download] Finished downloading offline files of ${key}`);
    }

    /** Where the server serves a file of an area from, see FilesController, a root file is of no area and is served by its name */
    private static getFileUrl(area: Immutable<OfflineArea>, serverFileName: string): string {
        return serverFileName.includes("+")
            ? `${Urls.offlineArea}/${area.properties.id}/${serverFileName}`
            : `${Urls.offlineFiles}/${serverFileName}`;
    }

    /**
     * Keeps an area that was downloaded for the first time on the device, after its files are, with the zooms they
     * hold. An area that was downloaded before is kept as it was, with the name the user gave it and the polygon
     * it was downloaded with.
     */
    private async keepNewArea(area: Immutable<OfflineArea>): Promise<void> {
        if (this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[area.properties.id]?.area == null) {
            await this.offlineAreasService.saveDownloadedArea({ ...area, properties: { ...area.properties, minZoom: AREA_MIN_ZOOM } });
        }
    }

    /**
     * Moves the files that were downloaded to where the app reads them from, and extracts the routing
     * tiles among them. This only happens once every file of the tile was downloaded, so that a download
     * that was aborted or failed leaves the files of the tile as they were rather than half updated.
     * Every file is moved before any of them is handed to the routing engine, so that an engine that
     * fails can not leave the files of the tile half moved, and failing to hand a file over is logged
     * and otherwise ignored: the map files of the tile are whole and are drawn from as they are, and a
     * tile that ended up without its routing tiles is reported as one to download again.
     * A file the routing engine did not take is deleted, since it is of no use to the app and nothing else
     * would ever clean it up - it is not one of the files the device is read for.
     */
    private async moveDownloadedFilesToDataDirectory(currentDownload: CurrentDownload, fileNames: FileToDownload[]): Promise<void> {
        const key = currentDownload.area.properties.id;
        for (const { fileName } of fileNames) {
            await this.fileService.moveFileFromCacheToDataDirectory(fileName);
        }
        for (const { fileName } of fileNames) {
            const isRoutingTilesFile = RoutingProvider.isRoutingTilesFile(fileName);
            if (!isRoutingTilesFile && !RoutingProvider.isRoutingProfilesFile(fileName)) {
                continue;
            }
            try {
                if (isRoutingTilesFile) {
                    await this.routingProvider.extractOfflineRoutingTiles(fileName, key);
                } else {
                    await this.routingProvider.storeRoutingProfiles(await this.fileService.readFileInDataDirectory(fileName));
                    await this.fileService.deleteFileInDataDirectory(fileName);
                }
            } catch (ex) {
                this.loggingService.warning(`[Offline Download] Failed to hand ${fileName} to the routing engine: ${(ex as Error).message}`);
                await this.fileService.deleteFileInDataDirectory(fileName);
            }
        }
        this.loggingService.info(`[Offline Download] Moved ${fileNames.length} files of ${key} to the data directory`);
    }

    /**
     * Reports how far the download of a tile or an area got, where every one of its files weighs the same.
     * A download that is no longer the current one has nothing to report - its files might still be
     * coming in after it was aborted, and that says nothing about the download that took its place.
     */
    private updateProgress(currentDownload: CurrentDownload, progressPerFile: Record<number, number>,
        fileNameIndex: number, progressValue: number, length: number) {
        progressPerFile[fileNameIndex] = progressValue;
        if (!this.isCurrent(currentDownload)) {
            return;
        }
        const totalProgress = Object.values(progressPerFile).reduce((a, b) => a + b, 0) / length;
        this.currentDownload.set({ ...currentDownload, progress: totalProgress * 100.0 });
    }


    /** Whether the given download is the one that is going on, they are told apart by their controller */
    private isCurrent(currentDownload: CurrentDownload): boolean {
        return this.currentDownload()?.abortController === currentDownload.abortController;
    }

    /**
     * Asks the server which of the files of an area need downloading, along with the root files, named the way they
     * are kept on the device. The root files are asked for by the date of the area, which lists them with almost
     * every download, since they are small and that is simpler than asking for them on their own.
     * The order the server lists them in is kept as it is: it lists the files that take it longest first,
     * and they are downloaded in the order they are listed in, see downloadOfflineFilesProgressAction.
     */
    private async getFilesToDownload(area: Immutable<OfflineArea>): Promise<FileToDownload[]> {
        const key = area.properties.id;
        const downloadedFiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[key]?.files;
        const isCompatible = downloadedFiles != null && this.getTileCompatibility(key, downloadedFiles) === "compatible";
        if (downloadedFiles != null && !isCompatible) {
            this.loggingService.info(`[Offline Download] Asking for every file of ${key}, what it holds can not be used`);
        }
        const lastModifiedString = isCompatible ? this.getLastModifiedDate(downloadedFiles)?.toISOString() : undefined;
        const params: Record<string, string> = lastModifiedString ? { lastModified: lastModifiedString } : {};
        const request = this.httpClient.get<Record<string, string>>(`${Urls.offlineArea}/${key}`, { params });
        const fileNames = await firstValueFrom(request.pipe(timeout(5000)));
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that need to be downloaded for ${key}, ` +
            `${lastModifiedString == null ? "all of them" : `the ones that changed since ${lastModifiedString}`}`);
        return Object.entries(fileNames).map(([serverFileName, date]) =>
            ({ fileName: OfflineFilesDownloadService.getLocalFileName(serverFileName, key), serverFileName, date }));
    }

    public abortCurrentDownload(): void {
        const currentDownload = this.currentDownload();
        if (currentDownload == null) {
            return;
        }
        // Every download has an abort controller of its own, so aborting one never touches the next
        this.loggingService.info("[Offline Download] Aborting the download of " + currentDownload.area.properties.id);
        currentDownload.abortController.abort();
        this.currentDownload.set(null);
    }

    /**
     * Deletes everything an area holds, its map files, its routing tiles and the file it is kept in alike. Failing
     * to remove the routing tiles is logged and otherwise ignored: the map files of the area are already gone, so
     * what the device holds has to be read again either way, and leaving the state as it was would keep an area
     * that is no longer there.
     */
    public async deleteArea(key: string): Promise<void> {
        this.loggingService.info(`[Offline Download] Deleting ${key}`);
        for (const { fileName } of this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[key]?.files ?? []) {
            this.loggingService.info(`[Offline Download] Deleting file ${fileName}`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
        try {
            await this.routingProvider.deleteOfflineRoutingTiles(key);
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to remove the routing tiles of ${key}: ${(ex as Error).message}`);
        }
        await this.offlineAreasService.deleteDownloadedArea(key);
        await this.updateDownloadedAreasFromDevice();
        if (!PmTilesService.isRootKey(key)) {
            await this.deleteUnusedRootFiles();
        }
    }

    /**
     * Deletes the root files once no area uses them, and the zoom 6 root files once no tile that came before areas
     * does, see PmTilesService.LEGACY_ROOT_KEY.
     */
    private async deleteUnusedRootFiles(): Promise<void> {
        const keys = Object.keys(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas));
        if (keys.includes(PmTilesService.LEGACY_ROOT_KEY) && !keys.some(key => PmTilesService.fromTileKey(key) != null)) {
            await this.deleteArea(PmTilesService.LEGACY_ROOT_KEY);
        }
        if (keys.includes(PmTilesService.ROOT_KEY) && keys.every(key => PmTilesService.isRootKey(key))) {
            await this.deleteArea(PmTilesService.ROOT_KEY);
        }
    }

    /**
     * Moves the files that were kept before areas existed to the name the files of an area are kept under: the files
     * of a tile, "name+7-x-y.pmtiles", to "name+x-y.pmtiles", and the root files, "name-6.pmtiles", to
     * "name+legacy-root.pmtiles", see PmTilesService.LEGACY_ROOT_KEY. It is done every time the app starts, so that
     * a start that was cut short in the middle of it finishes it the next time.
     * Failing is logged and leaves the files as they are.
     */
    private async migrateToAreas(): Promise<void> {
        try {
            for (const { fileName } of await this.fileService.listOfflineFilesInDataDirectory()) {
                const tileMatch = fileName.match(OfflineFilesDownloadService.TILE_FILE_NAME_REGEX);
                const rootMatch = fileName.match(OfflineFilesDownloadService.ROOT_FILE_NAME_REGEX);
                if (tileMatch != null) {
                    await this.fileService.renameFileInDataDirectory(fileName, `${tileMatch[1]}+${tileMatch[2]}${tileMatch[3]}`);
                } else if (rootMatch != null) {
                    const key = +rootMatch[2] === TILES_ZOOM - 1 ? PmTilesService.LEGACY_ROOT_KEY : PmTilesService.ROOT_KEY;
                    await this.fileService.renameFileInDataDirectory(fileName, `${rootMatch[1]}+${key}${rootMatch[3]}`);
                }
            }
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to rename the files that were kept before areas: ${(ex as Error).message}`);
        }
        await this.keepFilesWithoutAnAreaAsAreas();
    }

    /**
     * Keeps the files of a tile or the root files that are not kept as an area yet as one, with the zooms they hold,
     * so that they are read like any other area. A tile is kept without a name.
     * Failing is logged, an area that is kept already must never be kept again on top of the name the user gave it.
     */
    private async keepFilesWithoutAnAreaAsAreas(): Promise<void> {
        try {
            const areas = await this.offlineAreasService.loadDownloadedAreas();
            const keys = new Set((await this.fileService.listOfflineFilesInDataDirectory()).map(f => OfflineFilesDownloadService.getKey(f.fileName)));
            for (const key of keys) {
                const area = key == null || areas[key] != null ? null : OfflineFilesDownloadService.createAreaOfKey(key);
                if (area != null) {
                    this.loggingService.info(`[Offline Download] Keeping ${key} as an area`);
                    await this.offlineAreasService.saveDownloadedArea(area);
                }
            }
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to keep the tiles and the root files as areas: ${(ex as Error).message}`);
        }
    }

    /** The area of a tile or of the root files, null for an area the server offers, which is kept when it is downloaded */
    private static createAreaOfKey(key: string): OfflineArea | null {
        if (key === PmTilesService.ROOT_KEY) {
            return OfflineAreasService.createRootArea(key, ROOT_ZOOM);
        }
        if (key === PmTilesService.LEGACY_ROOT_KEY) {
            return OfflineAreasService.createRootArea(key, TILES_ZOOM - 1);
        }
        const tile = PmTilesService.fromTileKey(key);
        return tile == null ? null : OfflineAreasService.createTileArea(tile.tileX, tile.tileY);
    }

    /**
     * Reads what was downloaded into the state, which is the only place it is listed - there's nothing
     * stored that can go out of sync with the device. The map files are grouped by the area they are of, the
     * date of a file is the time it was written, which is when it was downloaded, and its version is only read
     * when it is needed, see updateVersionsOfDownloadedFiles. The areas are read from the files they are kept in
     * and the routing tiles from the routing plugin, which is what keeps them.
     * Failing to read the files is logged and otherwise ignored, leaving the state as it was.
     */
    public async updateDownloadedAreasFromDevice(): Promise<void> {
        const areaIdsWithRoutingTiles = await this.routingProvider.getAreasWithRoutingTiles();
        let offlineFiles: DataDirectoryFile[];
        let areas: Record<string, OfflineArea>;
        try {
            offlineFiles = await this.fileService.listOfflineFilesInDataDirectory();
            areas = await this.offlineAreasService.loadDownloadedAreas();
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to read the files on the device: ${(ex as Error).message}`);
            return;
        }
        const downloadedAreas: Record<string, DownloadedArea> = {};
        for (const file of offlineFiles) {
            const key = OfflineFilesDownloadService.getKey(file.fileName);
            if (key == null) {
                continue;
            }
            downloadedAreas[key] ??= { area: areas[key] ?? null, files: [], hasRoutingTiles: areaIdsWithRoutingTiles.includes(key) };
            downloadedAreas[key].files.push({ fileName: file.fileName, date: file.modifiedDate.toISOString() });
        }
        this.logDownloadedAreas(downloadedAreas, offlineFiles);
        this.store.dispatch(new SetDownloadedAreasAction(downloadedAreas));
    }

    /**
     * Reports what the device holds, so that a log a user sends explains what they had to work with.
     */
    private logDownloadedAreas(downloadedAreas: Record<string, DownloadedArea>, offlineFiles: DataDirectoryFile[]): void {
        if (offlineFiles.length === 0) {
            this.loggingService.info("[Offline Download] The device holds no offline files");
            return;
        }
        const downloadDates = offlineFiles.map(f => f.modifiedDate.getTime());
        const totalSize = offlineFiles.reduce((total, file) => total + file.size, 0);
        this.loggingService.info(`[Offline Download] The device holds ${offlineFiles.length} files of ` +
            `${Object.keys(downloadedAreas).length} areas, ${OfflineFilesDownloadService.toReadableSize(totalSize)}, ` +
            `downloaded between ${new Date(Math.min(...downloadDates)).toISOString()} and ` +
            `${new Date(Math.max(...downloadDates)).toISOString()}`);
        this.loggingService.info(`[Offline Download] The areas are: ${Object.entries(downloadedAreas)
            .map(([key, { files, hasRoutingTiles }]) => `${key} ` +
                `(${files.length} file${files.length === 1 ? "" : "s"}` +
                `${hasRoutingTiles ? ", with routing tiles" : ""})`).join(", ")}`);
    }

    /** A size that is readable in the logs, since they are read by a person and not by a machine */
    private static toReadableSize(bytes: number): string {
        const megabytes = bytes / 1024 / 1024;
        return megabytes >= 1024 ? `${(megabytes / 1024).toFixed(1)} GB` : `${megabytes.toFixed(0)} MB`;
    }

    /**
     * Reads the versions of the downloaded files, which means opening every one of them, and only of the
     * files the styles require a version from - the version of any other file is never compared to anything.
     */
    private async updateVersionsOfDownloadedFiles(): Promise<void> {
        const downloadedAreas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        if (Object.keys(this.onlineStyleRequirements.minVersionPerFile).length === 0) {
            return;
        }
        const areasWithVersions: Record<string, Immutable<DownloadedArea>> = {};
        for (const [key, downloadedArea] of Object.entries(downloadedAreas)) {
            const files: Immutable<FileNameDateVersion>[] = [];
            for (const file of downloadedArea.files) {
                const sourceFileName = OfflineFilesDownloadService.getSourceFileName(file.fileName).toLowerCase();
                if (file.version != null || this.onlineStyleRequirements.minVersionPerFile[sourceFileName] == null) {
                    files.push(file);
                    continue;
                }
                files.push({ ...file, version: await this.getVersion(file.fileName) });
            }
            areasWithVersions[key] = { ...downloadedArea, files };
        }
        this.store.dispatch(new SetDownloadedAreasAction(areasWithVersions as Record<string, DownloadedArea>));
    }

    /** The version of a file, undefined when it has none or when the file can not be read */
    private async getVersion(fileName: string): Promise<string | undefined> {
        try {
            return await this.pmtilesService.getVersion(fileName);
        } catch (ex) {
            this.loggingService.error(`[Offline Download] Failed to get the version of ${fileName}: ${(ex as Error).message}`);
            return undefined;
        }
    }

    /**
     * Deletes the offline files whose source is not used by the styles nor by the app - a source that was
     * removed or renamed leaves its files behind, only taking up space. Of the files of a tile only those
     * of the tile that is being downloaded are deleted: a tile the user did not ask for keeps what it has
     * until it is downloaded itself, so that downloading one tile never takes another one apart and leaves
     * the user without an area they see they have. The root files are of no tile and are not shown
     * anywhere, and the styles on the device are by now the ones that were just downloaded, so nothing on
     * the device can read a source they do not have - a root file of such a source is of no use to any
     * tile, downloaded or not, and goes as soon as it is found.
     * Only the offline map files are deleted, the styles and any other file that is stored in the same
     * directory are not this service's.
     */
    private async deleteFilesOfUnusedSources(tileKey: string): Promise<void> {
        if (this.onlineStyleRequirements.sourceFileNames.length === 0) {
            this.loggingService.warning("[Offline Download] The styles have no sources, keeping all the files");
            return;
        }
        const usedSourceFileNames = [...this.onlineStyleRequirements.sourceFileNames, ...OfflineFilesDownloadService.APPLICATION_SOURCE_FILE_NAMES];
        const files = await this.fileService.listOfflineFilesInDataDirectory();
        const unusedFiles = files.filter(f => !usedSourceFileNames.includes(OfflineFilesDownloadService.getSourceFileName(f.fileName).toLowerCase()));
        for (const { fileName } of unusedFiles) {
            const fileTileKey = OfflineFilesDownloadService.getKey(fileName);
            if (fileTileKey !== tileKey && (fileTileKey == null || !PmTilesService.isRootKey(fileTileKey))) {
                continue; // It is another tile's, and taking it apart would leave the user without that area
            }
            const sourceFileName = OfflineFilesDownloadService.getSourceFileName(fileName).toLowerCase();
            this.loggingService.info(`[Offline Download] Deleting ${fileName}, ${sourceFileName} is not a source of the styles`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
    }

    /**
     * The tiles that were downloaded before areas existed and that an area overlaps. They can no longer be
     * updated, so downloading the area replaces them and they are deleted once it is downloaded.
     */
    public getOverlappedTileKeys(area: Immutable<OfflineArea>): string[] {
        return Object.keys(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas))
            .filter(key => key !== area.properties.id)
            .map(key => PmTilesService.fromTileKey(key))
            .filter(tile => tile != null)
            .map(tile => OfflineAreasService.createTileArea(tile.tileX, tile.tileY))
            .filter(tileArea => booleanIntersects(tileArea, area as OfflineArea))
            .map(tileArea => tileArea.properties.id);
    }

    /** The time the newest file of a tile was downloaded at, which is when the tile was last updated */
    public getLastModifiedDate(files: Immutable<FileNameDateVersion[]>) {
        if (!files?.length) {
            return null;
        }
        let lastModified = new Date(0);
        for (const { date } of files) {
            if (new Date(date) > lastModified) {
                lastModified = new Date(date);
            }
        }
        return lastModified;
    }

    /**
     * How usable the files of a tile still are: they are "outdated" when only the style that was just
     * downloaded asks for more than they hold, which leaves the map drawn as it always was until they
     * are downloaded again, and "unusable" when the styles that are already on the device ask for more,
     * which is what makes the map itself come out wrong.
     */
    public getTileCompatibility(tileKey: string, files: Immutable<FileNameDateVersion[]>): TileCompatibility {
        if (!this.meetsRequirements(tileKey, files, this.offlineStyleRequirements)) {
            return "unusable";
        }
        if (!this.meetsRequirements(tileKey, files, this.onlineStyleRequirements) || !this.hasRoutingTiles(tileKey)) {
            return "outdated";
        }
        return "compatible";
    }

    /**
     * Whether the routing tiles of a tile are on the device. A tile that was downloaded before offline
     * routing existed has none and has to be downloaded again to get them, but the map itself is still
     * drawn from the files it does have, so such a tile is only out of date and not unusable.
     * The root files are not of a specific area, so they have no routing tiles of their own.
     */
    private hasRoutingTiles(tileKey: string): boolean {
        if (PmTilesService.isRootKey(tileKey)) {
            return true;
        }
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[tileKey]?.hasRoutingTiles === true;
    }

    /**
     * The names of the source files a tile is expected to hold. The server decides which source has files
     * of its own per tile and which only has root files - the elevation source, for example, has no root
     * file - so rather than assume, this takes the sources the styles use and keeps the ones that are
     * actually downloaded for tiles of the same kind, root or not, as any other tile on the device shows.
     */
    private getExpectedSourceFileNames(tileKey: string, requirements: StyleRequirements): string[] {
        const downloadedSourceFileNames = new Set<string>();
        for (const [otherTileKey, { files: otherFiles }] of Object.entries(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas))) {
            if (PmTilesService.isRootKey(otherTileKey) !== PmTilesService.isRootKey(tileKey)) {
                continue;
            }
            for (const { fileName } of otherFiles) {
                downloadedSourceFileNames.add(OfflineFilesDownloadService.getSourceFileName(fileName).toLowerCase());
            }
        }
        return requirements.sourceFileNames.filter(sourceFileName => downloadedSourceFileNames.has(sourceFileName));
    }

    /**
     * Whether the files of a tile are still the ones a style can be drawn with: it has a file of every
     * source the style uses, none of a source it no longer uses, and they are all new enough for it.
     * A source that was renamed shows up as both - the file of the old name is of no source of the style
     * and the new name has no file at all - and either way the tile can not be drawn and has to be
     * downloaded again. A file the style requires a version from but that has none is treated as too old,
     * either it was downloaded before the versions existed or it can not be read.
     */
    private meetsRequirements(tileKey: string, files: Immutable<FileNameDateVersion[]>, requirements: StyleRequirements): boolean {
        return this.getUnmetRequirement(tileKey, files, requirements) == null;
    }

    /**
     * What keeps the files of a tile from being drawn with a style, in words, or null when nothing does.
     * It says it rather than writes it to the log, since this is asked for every tile that is drawn on the
     * offline management screen every time anything on it changes - only the reasons that are worth
     * telling about are written, see initialize.
     */
    private getUnmetRequirement(tileKey: string, files: Immutable<FileNameDateVersion[]>, requirements: StyleRequirements): string | null {
        if (requirements.sourceFileNames.length === 0) {
            return null; // Nothing was read from the styles, so there is nothing to hold the files against
        }
        const sourceFileNamesOfTile = new Set(files.map(
            f => OfflineFilesDownloadService.getSourceFileName(f.fileName).toLowerCase()));
        const usedSourceFileNames = [...requirements.sourceFileNames, ...OfflineFilesDownloadService.APPLICATION_SOURCE_FILE_NAMES];
        for (const sourceFileName of sourceFileNamesOfTile) {
            if (!usedSourceFileNames.includes(sourceFileName)) {
                return `${sourceFileName} is not a source of the style`;
            }
        }
        for (const sourceFileName of this.getExpectedSourceFileNames(tileKey, requirements)) {
            if (!sourceFileNamesOfTile.has(sourceFileName)) {
                return `there is no file of ${sourceFileName}, which the style uses`;
            }
        }
        for (const fileDateVersion of files) {
            const sourceFileName = OfflineFilesDownloadService.getSourceFileName(fileDateVersion.fileName);
            const minVersion = requirements.minVersionPerFile[sourceFileName.toLowerCase()];
            if (minVersion == null) {
                continue;
            }
            if (!fileDateVersion.version) {
                return `${fileDateVersion.fileName} has no version while the style requires ${minVersion}`;
            }
            if (OfflineFilesDownloadService.compareVersions(fileDateVersion.version, minVersion) < 0) {
                return `${fileDateVersion.fileName} is at version ${fileDateVersion.version} ` +
                    `while the style requires ${minVersion}`;
            }
        }
        return null;
    }
}
