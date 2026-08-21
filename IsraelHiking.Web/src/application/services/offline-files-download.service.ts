import { computed, inject, Service, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { last } from "lodash-es";
import { Immutable } from "immer";
import pLimit from "p-limit";
import type { StyleSpecification } from "maplibre-gl";

import { Urls } from "../urls";
import { FileService, type DataDirectoryFile } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { PmTilesService } from "./pmtiles.service";
import { RoutingProvider } from "./routing.provider";
import { RunningContextService } from "./running-context.service";
import { RouteStrings } from "./hash.service";
import { SetDownloadedRoutingTilesAction, SetDownloadedTilesAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, FileNameDateVersion } from "../models";

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
    tileX: number;
    tileY: number;
    /** How much of the tile was downloaded so far, from 0 to 100 */
    progress: number;
    /** Identifies the download - a new one gets a new controller, and only it can abort it */
    abortController: AbortController;
};

@Service()
export class OfflineFilesDownloadService {
    /** The metadata key a style uses to declare the minimal version it needs from one of its sources */
    private static readonly MIN_VERSION_KEY_REGEX = /^sources:(.+):min-version$/;

    /** The extension of the offline map files, the only files in the data directory this service owns */
    private static readonly OFFLINE_FILE_EXTENSION = ".pmtiles";

    /**
     * Sources the app adds by itself instead of taking them from the style, see the public pois component.
     * Their files are downloaded and needed like the files of the style's own sources.
     */
    private static readonly APPLICATION_SOURCE_FILE_NAMES = ["global_points"];

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

    /** What the styles that were downloaded now need from the offline files, read every time they are downloaded */
    private onlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    /**
     * What the styles that are already on the device need. They are what the map is drawn with when there
     * is no network, and they are only replaced once every tile can be drawn with them, so a tile that
     * does not meet them is one the app can not draw correctly right now.
     */
    private offlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    private readonly currentDownload = signal<CurrentDownload | null>(null);

    /** The tile that is being downloaded right now and how far it got, null when there is no download */
    public readonly currentDownloadedTile = computed(() => {
        const currentDownload = this.currentDownload();
        return currentDownload == null
            ? null
            : { tileX: currentDownload.tileX, tileY: currentDownload.tileY, progress: currentDownload.progress };
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
        await this.updateDownloadedTilesFromDevice();
        await this.updateOfflineStyleRequirements();
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (userState == null || offlineState.isSubscribed === false) {
            return;
        }
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            await this.updateVersionsOfDownloadedFiles();
            const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
            const incompatibleTileKeys: string[] = [];
            for (const [tileKey, files] of Object.entries(downloadedTiles)) {
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
            const needToAskToRedownload = Object.keys(downloadedTiles).length === 0 || incompatibleTileKeys.length > 0;
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
            const content = await this.fileService.getStyleJsonContent(baseLayerUrl, true);
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
            const style = await firstValueFrom(this.httpClient.get(baseLayerUrl, { responseType: "text" }).pipe(timeout(5000)));
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
     * The name of the source file an offline file holds, as the server names them: tile files look like
     * "name+7-x-y.pmtiles" and root files like "name-6.pmtiles", where the name itself may contain a "-".
     */
    private static getSourceFileName(fileName: string): string {
        const plusIndex = fileName.indexOf("+");
        if (plusIndex >= 0) {
            return fileName.substring(0, plusIndex);
        }
        return OfflineFilesDownloadService.removeExtension(fileName).replace(/-\d+$/, "");
    }

    /**
     * The id of the tile an offline file belongs to, taken from its name: a tile file is named
     * "name+7-x-y.pmtiles" while a root file, which is not of a specific tile, is named "name-6.pmtiles".
     * Returns null for a file that is named like neither of them.
     */
    private static getTileKey(fileName: string): string | null {
        const plusIndex = fileName.indexOf("+");
        if (plusIndex < 0) {
            return PmTilesService.toTileKey();
        }
        const zoomAndTile = OfflineFilesDownloadService.removeExtension(fileName.substring(plusIndex + 1));
        const tileKey = zoomAndTile.substring(zoomAndTile.indexOf("-") + 1);
        return PmTilesService.fromTileKey(tileKey) == null ? null : tileKey;
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
     * Downloads everything a tile needs. A download that is still going on when this is called is aborted
     * first, so that the one the user asked for last is the only one that goes on.
     */
    public async downloadTile(tileX: number, tileY: number): Promise<"up-to-date" | "downloaded" | "error" | "aborted"> {
        this.abortCurrentDownload();
        const currentDownload: CurrentDownload = { tileX, tileY, progress: 0, abortController: new AbortController() };
        this.currentDownload.set(currentDownload);
        const tileKey = PmTilesService.toTileKey(tileX, tileY);
        this.loggingService.info(`[Offline Download] Starting downloading the offline files of ${tileKey}`);
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            await this.writeStylesToDevice(styles);
            await this.deleteFilesOfUnusedSources(tileKey);
            // What is asked of the server is decided by the state, so it is read again now that files were deleted
            await this.updateDownloadedTilesFromDevice();
            const fileNamesForRoot = await this.getFilesToDownload();
            const fileNamesForTile = await this.getFilesToDownload(tileX, tileY);
            if (fileNamesForTile.length === 0 && fileNamesForRoot.length === 0) {
                this.loggingService.info("[Offline Download] No files to download, all files are up to date");
                return "up-to-date";
            }
            const fileNames = [...fileNamesForRoot, ...fileNamesForTile];
            await this.downloadOfflineFilesProgressAction(currentDownload, fileNames, fileNamesForRoot.length);

            if (currentDownload.abortController.signal.aborted) {
                return "aborted";
            }

            await this.moveDownloadedFilesToDataDirectory(currentDownload, fileNames);
            // The files that were just moved in are what the app has now, with the versions of the new ones
            await this.updateDownloadedTilesFromDevice();
            await this.updateVersionsOfDownloadedFiles();
            return "downloaded";
        } catch (ex) {
            if (currentDownload.abortController.signal.aborted) {
                // Aborting makes whatever was going on at that moment fail, which is not an error
                this.loggingService.info("[Offline Download] The download was aborted while it was going on");
                return "aborted";
            }
            const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
            switch (typeAndMessage.type) {
                case "timeout":
                    this.loggingService.error(`[Offline Download] The download of ${tileKey} failed due to timeout`);
                    break;
                case "client":
                    this.loggingService.error(`[Offline Download] The download of ${tileKey} failed due to client side error: ` +
                        typeAndMessage.message);
                    break;
                default:
                    this.loggingService.error(`[Offline Download] The download of ${tileKey} failed due to server side error: ` +
                        typeAndMessage.message);
            }
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
     */
    private async downloadOfflineFilesProgressAction(currentDownload: CurrentDownload, fileNames: FileNameDateVersion[], rootFilesCount: number): Promise<void> {
        const { tileX, tileY, abortController } = currentDownload;
        this.loggingService.info(`[Offline Download] Starting downloading offline files, total files: ${fileNames.length}, tile: ${tileX}-${tileY}`);
        const length = fileNames.length;
        const progressPerFile: Record<number, number> = {};
        const alreadyDownloaded = await this.fileService.listFilesInOfflineCache();
        const fileDownloadPromises: Promise<void>[] = [];
        const limit = pLimit(3);
        for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
            const { fileName } = fileNames[fileNameIndex];
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
            let fileDownloadUrl = `${Urls.offlineFiles}/${fileName}`;
            if (fileNameIndex >= rootFilesCount) {
                fileDownloadUrl += `?tileX=${tileX}&tileY=${tileY}`;
            }

            fileDownloadPromises.push(limit(() => this.fileService.downloadFileToCacheAuthenticated(fileDownloadUrl, fileName, token,
                value => this.updateProgress(currentDownload, progressPerFile, fileNameIndex, value, length), abortController)));
        }
        await Promise.all(fileDownloadPromises);
        this.loggingService.info(`[Offline Download] Finished downloading offline files, current tile: ${PmTilesService.toTileKey(tileX, tileY)}`);
    }

    /**
     * Moves the files that were downloaded to where the app reads them from, and extracts the routing
     * tiles among them. This only happens once every file of the tile was downloaded, so that a download
     * that was aborted or failed leaves the files of the tile as they were rather than half updated.
     */
    private async moveDownloadedFilesToDataDirectory(currentDownload: CurrentDownload, fileNames: FileNameDateVersion[]): Promise<void> {
        const tileKey = PmTilesService.toTileKey(currentDownload.tileX, currentDownload.tileY);
        for (const { fileName } of fileNames) {
            await this.fileService.moveFileFromCacheToDataDirectory(fileName);
            if (RoutingProvider.isRoutingTilesFile(fileName)) {
                await this.routingProvider.extractOfflineRoutingTiles(fileName, tileKey);
            } else if (RoutingProvider.isRoutingSetupFile(fileName)) {
                await this.routingProvider.storeRoutingSetupFile(fileName, await this.fileService.readFileInDataDirectory(fileName));
                await this.fileService.deleteFileInDataDirectory(fileName);
            }
        }
        this.loggingService.info(`[Offline Download] Moved ${fileNames.length} files of ${tileKey} to the data directory`);
    }

    /**
     * Reports how far the download of a tile got, where every one of its files weighs the same.
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

    private async getFilesToDownload(tileX?: number, tileY?: number): Promise<FileNameDateVersion[]> {
        const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
        const tileKey = PmTilesService.toTileKey(tileX, tileY);
        const downloadedTile = downloadedTiles[tileKey];
        const isCompatible = downloadedTile != null &&
            this.getTileCompatibility(tileKey, downloadedTile) === "compatible";
        if (downloadedTile != null && !isCompatible) {
            this.loggingService.info(`[Offline Download] Asking for every file of ${tileKey}, what it holds can not be used`);
        }
        const lastModifiedString = isCompatible ? this.getLastModifiedDate(downloadedTile)?.toISOString() : undefined;
        const params: Record<string, string> = {};
        if (lastModifiedString) {
            params.lastModified = lastModifiedString;
        }
        if (tileX != null && tileY != null) {
            params.tileX = tileX.toString();
            params.tileY = tileY.toString();
        }
        params.routingTile = "true";
        const fileNames = await firstValueFrom(this.httpClient.get<Record<string, string>>(Urls.offlineFiles, { params: params }).pipe(timeout(5000)));
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that need to be downloaded ` +
            `for ${tileKey === PmTilesService.toTileKey() ? "the root files" : tileKey}, ` +
            `${lastModifiedString == null ? "all of them" : `the ones that changed since ${lastModifiedString}`}`);
        if (Object.keys(fileNames).length === 0) {
            return [];
        }
        return Object.entries(fileNames).map(([key, value]) => ({ fileName: key, date: value }));
    }

    public abortCurrentDownload(): void {
        const currentDownload = this.currentDownload();
        if (currentDownload == null) {
            return;
        }
        // Every download has an abort controller of its own, so aborting one never touches the next
        this.loggingService.info("[Offline Download] Aborting the download of " +
            PmTilesService.toTileKey(currentDownload.tileX, currentDownload.tileY));
        currentDownload.abortController.abort();
        this.currentDownload.set(null);
    }

    public async deleteTile(tileKey: string): Promise<void> {
        this.loggingService.info(`[Offline Download] Deleting tile ${tileKey}`);
        const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
        for (const { fileName } of downloadedTiles[tileKey] ?? []) {
            this.loggingService.info(`[Offline Download] Deleting file ${fileName}`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
        await this.routingProvider.deleteOfflineRoutingTiles(tileKey);
        await this.updateDownloadedTilesFromDevice();
        // The root files are only needed as long as there's an area that uses them.
        const rootTileId = PmTilesService.toTileKey();
        if (tileKey === rootTileId) {
            return;
        }
        const remainingTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
        if (Object.keys(remainingTiles).length === 1 && remainingTiles[rootTileId] != null) {
            await this.deleteTile(rootTileId);
        }
    }

    /**
     * Reads what was downloaded into the state, which is the only place it is listed - there's nothing
     * stored that can go out of sync with the device. The routing tiles are read from the routing plugin,
     * which is what keeps them, and the rest from the files themselves: the date of a file is the time it
     * was written, which is when it was downloaded, and its version is only read when it is needed, see
     * updateVersionsOfDownloadedFiles.
     * Failing to read the files is logged and otherwise ignored, leaving them in the state as they were.
     */
    public async updateDownloadedTilesFromDevice(): Promise<void> {
        this.store.dispatch(new SetDownloadedRoutingTilesAction(await this.routingProvider.getOfflineRoutingTiles()));
        let files: DataDirectoryFile[];
        try {
            files = await this.fileService.listFilesInDataDirectory();
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to read the files on the device: ${(ex as Error).message}`);
            return;
        }
        const offlineFiles = files.filter(f => f.fileName.endsWith(OfflineFilesDownloadService.OFFLINE_FILE_EXTENSION));
        const downloadedTiles: Record<string, FileNameDateVersion[]> = {};
        for (const file of offlineFiles) {
            const tileKey = OfflineFilesDownloadService.getTileKey(file.fileName);
            if (tileKey == null) {
                this.loggingService.warning(`[Offline Download] Can not tell which tile ${file.fileName} belongs to`);
                continue;
            }
            downloadedTiles[tileKey] = [
                ...downloadedTiles[tileKey] ?? [],
                { fileName: file.fileName, date: file.modifiedDate.toISOString() }
            ];
        }
        this.logDownloadedTiles(downloadedTiles, offlineFiles);
        this.store.dispatch(new SetDownloadedTilesAction(downloadedTiles));
    }

    /**
     * Reports what the device holds, so that a log a user sends explains what they had to work with.
     */
    private logDownloadedTiles(downloadedTiles: Record<string, FileNameDateVersion[]>, offlineFiles: DataDirectoryFile[]): void {
        if (offlineFiles.length === 0) {
            this.loggingService.info("[Offline Download] The device holds no offline files");
            return;
        }
        const downloadDates = offlineFiles.map(f => f.modifiedDate.getTime());
        const totalSize = offlineFiles.reduce((total, file) => total + file.size, 0);
        const downloadedRoutingTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedRoutingTiles);
        this.loggingService.info(`[Offline Download] The device holds ${offlineFiles.length} files of ` +
            `${Object.keys(downloadedTiles).length} tiles, ${OfflineFilesDownloadService.toReadableSize(totalSize)}, ` +
            `downloaded between ${new Date(Math.min(...downloadDates)).toISOString()} and ` +
            `${new Date(Math.max(...downloadDates)).toISOString()}`);
        const rootTileKey = PmTilesService.toTileKey();
        this.loggingService.info(`[Offline Download] The tiles are: ${Object.entries(downloadedTiles)
            .map(([tileKey, tileFiles]) => `${tileKey === rootTileKey ? "root" : tileKey} ` +
                `(${tileFiles.length} file${tileFiles.length === 1 ? "" : "s"}` +
                `${downloadedRoutingTiles.includes(tileKey) ? ", with routing tiles" : ""})`).join(", ")}`);
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
        const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
        if (Object.keys(this.onlineStyleRequirements.minVersionPerFile).length === 0) {
            return;
        }
        const tilesWithVersions: Record<string, FileNameDateVersion[]> = {};
        for (const [tileKey, files] of Object.entries(downloadedTiles)) {
            tilesWithVersions[tileKey] = [];
            for (const file of files) {
                const sourceFileName = OfflineFilesDownloadService.getSourceFileName(file.fileName).toLowerCase();
                if (file.version != null || this.onlineStyleRequirements.minVersionPerFile[sourceFileName] == null) {
                    tilesWithVersions[tileKey].push(file);
                    continue;
                }
                tilesWithVersions[tileKey].push({ ...file, version: await this.getVersion(file.fileName) });
            }
        }
        this.store.dispatch(new SetDownloadedTilesAction(tilesWithVersions));
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
     * removed or renamed leaves its files behind, only taking up space. Only the files of the tile that is
     * being downloaded are deleted: a tile the user did not ask for keeps what it has until it is
     * downloaded itself, so that downloading one tile never takes another one apart. The root files are
     * shared by every tile, so they only go once no tile is left that still holds that source.
     * Only the offline map files are deleted, the styles and any other file that is stored in the same
     * directory are not this service's.
     */
    private async deleteFilesOfUnusedSources(tileKey: string): Promise<void> {
        if (this.onlineStyleRequirements.sourceFileNames.length === 0) {
            this.loggingService.warning("[Offline Download] The styles have no sources, keeping all the files");
            return;
        }
        const usedSourceFileNames = [...this.onlineStyleRequirements.sourceFileNames, ...OfflineFilesDownloadService.APPLICATION_SOURCE_FILE_NAMES];
        const rootTileKey = PmTilesService.toTileKey();
        const files = await this.fileService.listFilesInDataDirectory();
        const unusedFiles = files.filter(f => f.fileName.endsWith(OfflineFilesDownloadService.OFFLINE_FILE_EXTENSION) &&
            !usedSourceFileNames.includes(OfflineFilesDownloadService.getSourceFileName(f.fileName).toLowerCase()));
        for (const { fileName } of unusedFiles) {
            const fileTileKey = OfflineFilesDownloadService.getTileKey(fileName);
            if (fileTileKey !== tileKey && fileTileKey !== rootTileKey) {
                continue; // It is another tile's, and that tile still needs it until it is downloaded again
            }
            const sourceFileName = OfflineFilesDownloadService.getSourceFileName(fileName).toLowerCase();
            const isLeftToAnotherTile = fileTileKey === rootTileKey && unusedFiles.some(other => {
                const otherTileKey = OfflineFilesDownloadService.getTileKey(other.fileName);
                return otherTileKey !== rootTileKey && otherTileKey !== tileKey &&
                    OfflineFilesDownloadService.getSourceFileName(other.fileName).toLowerCase() === sourceFileName;
            });
            if (isLeftToAnotherTile) {
                continue;
            }
            this.loggingService.info(`[Offline Download] Deleting ${fileName}, ${sourceFileName} is not a source of the styles`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
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
        if (tileKey === PmTilesService.toTileKey()) {
            return true;
        }
        const downloadedRoutingTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedRoutingTiles);
        return downloadedRoutingTiles.includes(tileKey);
    }

    /**
     * The names of the source files a tile is expected to hold. The server decides which source has files
     * of its own per tile and which only has root files - the elevation source, for example, has no root
     * file - so rather than assume, this takes the sources the styles use and keeps the ones that are
     * actually downloaded for tiles of the same kind, root or not, as any other tile on the device shows.
     */
    private getExpectedSourceFileNames(tileKey: string, requirements: StyleRequirements): string[] {
        const rootTileKey = PmTilesService.toTileKey();
        const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedTiles);
        const downloadedSourceFileNames = new Set<string>();
        for (const [otherTileKey, otherFiles] of Object.entries(downloadedTiles)) {
            if ((otherTileKey === rootTileKey) !== (tileKey === rootTileKey)) {
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
