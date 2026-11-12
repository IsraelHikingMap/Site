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
import { App } from "@capacitor/app";

import { Urls } from "../urls";
import { FileService, type DataDirectoryFile } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { PmTilesService } from "./pmtiles.service";
import { SpatialHelper } from "./spatial.helper";
import { RoutingProvider } from "./routing.provider";
import { RunningContextService } from "./running-context.service";
import { RouteStrings } from "./hash.service";
import { OfflineAreasService, type AreaZooms } from "./offline-areas.service";
import { OFFLINE_DOWNLOAD, type FailedAreaFile, type AreaDownloadState } from "./offline-download.plugin";
import { SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { SetAreaDownloadInProgressAction } from "../reducers/offline.reducer";
import type { ApplicationState, DownloadedArea, FileNameDateVersion, OfflineArea } from "../models";

/** What the styles need from the offline files, see readStyleRequirements */
type StyleRequirements = {
    /** The minimal version a source file needs to be at, keyed by the lower cased name of that file */
    minVersionPerFile: Record<string, string>;
    /** The lower cased names of the files of the sources the styles use */
    sourceFileNames: string[];
};

/**
 * How usable the files of an area still are, see getAreaCompatibility. "outdated" only means that a newer
 * style wants more than they hold, while "unusable" means the map is already drawn wrong without them.
 */
export type AreaCompatibility = "compatible" | "outdated" | "unusable";

/** The download that is going on right now, everything that lives as long as it does */
type CurrentDownload = {
    area: Immutable<OfflineArea>;
    /** How much was downloaded so far, from 0 to 100 */
    progress: number;
    /** Identifies the download - a new one gets a new controller, and only it can abort it */
    abortController: AbortController;
};

export type DownloadStatus = "up-to-date" | "downloaded" | "error" | "aborted";

/** The area that is being downloaded and how much of it was downloaded so far, from 0 to 100 */
export type DownloadInProgress = { area: Immutable<OfflineArea>; progress: number };

/** How a download of the native background download ended */
type BackgroundDownloadResult = { state: AreaDownloadState; failedFiles: FailedAreaFile[] };

@Service()
export class OfflineFilesDownloadService {
    /** The metadata id a style uses to declare the minimal version it needs from one of its sources */
    private static readonly MIN_VERSION_KEY_REGEX = /^sources:(.+):min-version$/;

    /**
     * Sources the app adds by itself instead of taking them from the style, see the public pois component.
     * Their files are downloaded and needed like the files of the style's own sources.
     */
    private static readonly APPLICATION_SOURCE_FILE_NAMES = ["global_points"];

    /** How many files are downloaded at a time */
    private static readonly DOWNLOAD_CONCURRENCY = 3;

    /** The zoom the old tiles were cut at, which the migration makes their squares at */
    private static readonly TILES_ZOOM = 7;
    /** The name of the files of an old tile, which the migration moves, "name+7-x-y.pmtiles" */
    private static readonly TILE_FILE_NAME_REGEX = new RegExp(`^(.+)\\+${OfflineFilesDownloadService.TILES_ZOOM}-(\\d+)-(\\d+)(\\.\\w+)$`);
    /** The name of the old root files, which the migration moves, "name-6.pmtiles" */
    private static readonly LEGACY_ROOT_FILE_NAME_REGEX = new RegExp(`^([^+]+)-${OfflineFilesDownloadService.TILES_ZOOM - 1}(\\.pmtiles)$`);

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
    /** The native background download, which goes on while the app is in the background, null where files are downloaded with fetch */
    private readonly offlineDownload = inject(OFFLINE_DOWNLOAD);

    /** What the styles that were downloaded now need from the offline files, read every time they are downloaded */
    private onlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    /**
     * What the styles that are already on the device need. They are what the map is drawn with when there
     * is no network, and they are only replaced once every area can be drawn with them, so an area that
     * does not meet them is one the app can not draw correctly right now.
     */
    private offlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    private readonly currentDownload = signal<CurrentDownload | null>(null);
    private readonly isBackgroundDownloadAvailable = this.offlineDownload != null;
    /** Ends the background download the app is following, see followBackgroundDownload */
    private finishBackgroundDownload: ((result: BackgroundDownloadResult) => void) | null = null;

    /** The area that is being downloaded right now and how far it got, null when there is no download */
    public readonly downloadInProgress = computed<DownloadInProgress | null>(() => {
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
        if (this.isBackgroundDownloadAvailable) {
            this.offlineDownload.addListener("diagnostic", event => this.loggingService.info(`[Offline Download] [native] ${event.message}`));
            App.addListener("appStateChange", state => state.isActive && this.resumeBackgroundDownload());
        }
        if (!await this.resumeBackgroundDownload()) {
            await this.fileService.clearOfflineCache();
        }
        await this.migrateToAreas();
        let downloadedAreas = await this.updateDownloadedAreasFromDevice();
        downloadedAreas = await this.deleteUnusedRootFiles(downloadedAreas);
        await this.updateOfflineStyleRequirements();
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (userState == null || offlineState.isSubscribed === false) {
            return;
        }
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            downloadedAreas = await this.updateVersionsOfDownloadedFiles(downloadedAreas);
            const incompatibleIds: string[] = [];
            for (const [id, { files }] of Object.entries(downloadedAreas)) {
                if (OfflineAreasService.isRootId(id)) {
                    continue;
                }
                const compatibility = this.getAreaCompatibility(id, files);
                if (compatibility === "compatible") {
                    continue;
                }
                incompatibleIds.push(id);
                const reason = this.getUnmetRequirement(id, files, this.offlineStyleRequirements)
                    ?? this.getUnmetRequirement(id, files, this.onlineStyleRequirements);
                this.loggingService.info(`[Offline Download] ${id} is ${compatibility}${reason == null ? "" : `: ${reason}`}`);
            }
            if (incompatibleIds.length > 0) {
                this.loggingService.info(`[Offline Download] These tiles need to be downloaded again: ${incompatibleIds.join(", ")}`);
            }
            const needToAskToRedownload = Object.keys(downloadedAreas).length === 0 || incompatibleIds.length > 0;
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
     * Reads what the styles that are on the device require, so that an area that can not be drawn with them
     * is told apart from one that only lacks what a newer style asks for. A style that is not on the device
     * reads as empty and requires nothing - without it there is nothing to say the areas are drawn wrong.
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
     * the source in the style - the "IHM" source, for example, is downloaded as "IHM-schema+{id}.pmtiles".
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

    /** The name of the source file an offline file holds, the files look like "name+id.pmtiles" */
    private static getSourceFileName(fileName: string): string {
        const plusIndex = fileName.indexOf("+");
        return plusIndex < 0 ? OfflineFilesDownloadService.removeExtension(fileName) : fileName.substring(0, plusIndex);
    }

    /** The id of the area an offline file is of, taken from its name, "name+id.pmtiles", null for a file that is of none */
    private static getAreaId(fileName: string): string | null {
        const plusIndex = fileName.indexOf("+");
        return plusIndex < 0 ? null : OfflineFilesDownloadService.removeExtension(fileName.substring(plusIndex + 1));
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
     * Downloads everything an area needs. A download that is still going on when this is called is aborted first, so that the one the user asked for
     * last is the only one that goes on.
     * A download that failed is logged with what it failed on rather than with a status code alone: a
     * request that got no answer is the connection and not the server, which is how a download of hundreds
     * of megabytes fails when it drops, and calling that a server side error sends whoever reads the log
     * the wrong way.
     */
    public async downloadArea(area: Immutable<OfflineArea>, replacedAreaIds: string[]): Promise<DownloadStatus> {
        this.abortCurrentDownload();
        const currentDownload: CurrentDownload = { area, progress: 0, abortController: new AbortController() };
        this.currentDownload.set(currentDownload);
        const id = area.properties.id;
        this.loggingService.info(`[Offline Download] Starting downloading the offline files of ${id}`);
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            await this.writeStylesToDevice(styles);
            await this.deleteFilesOfUnusedSources(id);
            const downloadedAreas = await this.updateDownloadedAreasFromDevice();
            const fileNames = await this.getFilesToDownload(area, downloadedAreas[id]?.files);
            if (fileNames.length === 0) {
                this.loggingService.info("[Offline Download] No files to download, all files are up to date");
                return "up-to-date";
            }
            await this.downloadOfflineFilesProgressAction(currentDownload, fileNames, replacedAreaIds);

            if (currentDownload.abortController.signal.aborted) {
                return "aborted";
            }

            await this.completeDownload(currentDownload, fileNames, replacedAreaIds);
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
            this.loggingService.error(`[Offline Download] The download of ${id} failed due to ${reason}: ${typeAndMessage.message}`);
            return "error";
        } finally {
            // A download that was aborted might only get here after the next one started, and it is not its to clear
            if (this.isCurrent(currentDownload)) {
                this.currentDownload.set(null);
                this.clearAreaDownloadInProgress();
            }
        }
    }

    /**
     * Puts the files of an area that were all downloaded where the app reads them from, keeps the area with the zooms
     * they hold, deletes the areas it replaces and reads what the device holds now.
     */
    private async completeDownload(currentDownload: CurrentDownload, fileNames: string[], replacedAreaIds: Immutable<string[]>): Promise<void> {
        const { area } = currentDownload;
        await this.moveDownloadedFilesToDataDirectory(currentDownload, fileNames);
        await this.offlineAreasService.saveAreaMetadata(area, await this.getZooms(area.properties.id, fileNames));
        await this.saveRootAreaMetadataIfDownloaded(fileNames);
        for (const replacedAreaId of replacedAreaIds) {
            await this.deleteArea(replacedAreaId);
        }
        const updatedAreas = await this.updateDownloadedAreasFromDevice();
        await this.updateVersionsOfDownloadedFiles(updatedAreas);
    }

    /**
     * Downloads the files into the cache, where a download that was aborted or failed leaves whatever it
     * did get, so that downloading the area again continues from there instead of starting over.
     * A few files are downloaded at a time, in the order they were listed in, which is why the server
     * lists the files that take it longest first - a file that is started last is the one left downloading
     * on its own once every other file is done.
     * A file that is already whole in the cache is not downloaded again.
     */
    private async downloadOfflineFilesProgressAction(currentDownload: CurrentDownload, fileNames: string[], replacedAreaIds: string[]): Promise<void> {
        const { area, abortController } = currentDownload;
        const id = area.properties.id;
        this.loggingService.info(`[Offline Download] Starting downloading offline files, total files: ${fileNames.length}, of: ${id}`);
        const length = fileNames.length;
        const progressPerFile: Record<number, number> = {};
        const alreadyDownloaded = await this.fileService.listFilesInOfflineCache();
        const fileDownloadPromises: Promise<void>[] = [];
        const backgroundFiles: { fileName: string; url: string }[] = [];
        const limit = pLimit(OfflineFilesDownloadService.DOWNLOAD_CONCURRENCY);
        for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
            const fileName = fileNames[fileNameIndex];
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
            const fileDownloadUrl = `${Urls.offlineArea}/${id}/${fileName}`;
            if (this.isBackgroundDownloadAvailable) {
                backgroundFiles.push({ fileName, url: fileDownloadUrl });
                continue;
            }
            fileDownloadPromises.push(limit(() => this.fileService.downloadFileToCacheAuthenticated(fileDownloadUrl, fileName, token,
                value => this.updateProgress(currentDownload, progressPerFile, fileNameIndex, value, length), abortController)));
        }
        if (backgroundFiles.length > 0) {
            await this.downloadInBackground(currentDownload, fileNames, backgroundFiles, progressPerFile, replacedAreaIds);
        }
        if (fileDownloadPromises.length > 0) {
            this.toastService.info(this.resources.dontSwitchApps);
        }
        await Promise.all(fileDownloadPromises);
        this.loggingService.info(`[Offline Download] Finished downloading offline files of ${id}`);
    }

    /**
     * Downloads the files with the native background download, which goes on while the app is in the
     * background. The area and all its files are kept in the state until they were moved, so that a download
     * the app did not see end is finished on its next start, see resumeBackgroundDownload.
     * A download that failed on an HTTP status throws with that status, so that downloadArea tells the server
     * apart from the connection the same way it does for a fetch download. A download that was cancelled without
     * the app asking for it, from the progress iOS shows, is aborted the way the app aborts one.
     */
    private async downloadInBackground(currentDownload: CurrentDownload, fileNames: string[],
        files: { fileName: string; url: string }[], progressPerFile: Record<number, number>, replacedAreaIds: string[]): Promise<void> {
        const id = currentDownload.area.properties.id;
        this.store.dispatch(new SetAreaDownloadInProgressAction({ area: currentDownload.area as OfflineArea, files: fileNames, replacedAreaIds }));
        const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
        const directory = await this.fileService.getOfflineCacheUri();
        const result = await this.followBackgroundDownload(currentDownload, fileNames, progressPerFile,
            async () => this.reportBackgroundDownloadStart(id, await this.offlineDownload.startAreaDownload({
                areaId: id,
                files,
                headers: { Authorization: `Bearer ${token}` },
                concurrency: OfflineFilesDownloadService.DOWNLOAD_CONCURRENCY,
                directory,
                title: this.resources.downloadMapForOfflineViewing,
                subtitle: this.resources.mapeakPro
            })));
        this.logBackgroundDownloadResult(id, result);
        if (result.state === "cancelled" && !currentDownload.abortController.signal.aborted) {
            this.abortCurrentDownload();
            return;
        }
        if (result.state !== "completed" && !currentDownload.abortController.signal.aborted) {
            const statusCode = result.failedFiles.map(f => /^HTTP (\d+)$/.exec(f.reason)?.[1]).find(code => code != null);
            throw Object.assign(new Error(`The background download of ${id} ended ${result.state}: ` +
                result.failedFiles.map(f => `${f.fileName} - ${f.reason}`).join(", ")), { status: statusCode == null ? undefined : +statusCode });
        }
    }

    /**
     * Tells the user to keep the app in the foreground when the download does not go on in the background, which
     * is the case on iOS before 26 and when iOS did not launch the continued task in time.
     */
    private reportBackgroundDownloadStart(id: string, started: { background: boolean; launchDelay?: number }): void {
        this.loggingService.info(`[Offline Download] The download of ${id} started, ` +
            `${started.background ? "it goes on in the background" : "it stops while the app is in the background"}` +
            `${started.launchDelay == null ? "" : `, its continued task launched after ${started.launchDelay}ms`}`);
        if (!started.background) {
            this.toastService.info(this.resources.dontSwitchApps);
        }
    }

    /**
     * Follows the background download of an area until it ends, with its progress reported like the one of a
     * fetch download. It also ends when the download is aborted, or when the app finds out how it ended
     * without having heard it, see resumeBackgroundDownload. The listeners are added before the download is
     * started, so that not even a download that ends at once is missed, while what the app finds out is only taken
     * once the download was started, before that it is about the download that came before.
     */
    private async followBackgroundDownload(currentDownload: CurrentDownload, fileNames: Immutable<string[]>,
        progressPerFile: Record<number, number>, start: () => Promise<void>): Promise<BackgroundDownloadResult> {
        const id = currentDownload.area.properties.id;
        const fileNameIndexes = new Map(fileNames.map((fileName, index) => [fileName, index]));
        const updateFileProgress = (fileName: string, fraction: number) => {
            if (fileNameIndexes.has(fileName)) {
                this.updateProgress(currentDownload, progressPerFile, fileNameIndexes.get(fileName), fraction, fileNames.length);
            }
        };
        let finish: (result: BackgroundDownloadResult) => void;
        const finished = new Promise<BackgroundDownloadResult>(resolve => finish = resolve);
        const handles = await Promise.all([
            this.offlineDownload.addListener("fileProgress", event => event.areaId === id && updateFileProgress(event.fileName, event.fraction)),
            this.offlineDownload.addListener("fileCompleted", event => event.areaId === id && updateFileProgress(event.fileName, 1)),
            this.offlineDownload.addListener("areaFinished", event => event.areaId === id && finish(event))
        ]);
        const onAbort = () => finish({ state: "cancelled", failedFiles: [] });
        currentDownload.abortController.signal.addEventListener("abort", onAbort);
        try {
            await start();
            this.finishBackgroundDownload = finish;
            return await finished;
        } finally {
            currentDownload.abortController.signal.removeEventListener("abort", onAbort);
            if (this.finishBackgroundDownload === finish) {
                this.finishBackgroundDownload = null;
            }
            await Promise.all(handles.map(handle => handle.remove()));
        }
    }

    /**
     * Asks the background download how the area download in progress stands, when the app starts and whenever
     * it returns to the foreground. A download the app is following ends once it is found to have ended, and
     * one that a previous run of the app left is followed and finished, or forgotten when it failed.
     * Returns whether the files in the cache must be kept: those of a download that is still going on, and those
     * of one that iOS stopped when the app was force-quit or its process ended, which downloading the area again
     * goes on from.
     */
    private async resumeBackgroundDownload(): Promise<boolean> {
        const inProgress = this.store.selectSnapshot((s: ApplicationState) => s.offlineState.areaDownloadInProgress);
        if (!this.isBackgroundDownloadAvailable || inProgress == null) {
            return false;
        }
        const id = inProgress.area.properties.id;
        try {
            const result = await this.offlineDownload.getAreaDownload({ areaId: id });
            if (this.currentDownload() != null) {
                if (result.state !== "running") {
                    this.finishBackgroundDownload?.(result);
                }
                return true;
            }
            this.loggingService.info(`[Offline Download] The download of ${id} that a previous run of the app started is ${result.state}`);
            if (result.state === "running" || result.state === "completed") {
                this.finishLeftBackgroundDownload(inProgress, result);
                return true;
            }
            this.logBackgroundDownloadResult(id, result);
            this.clearAreaDownloadInProgress();
            return result.state === "failed" && result.failedFiles.some(f => f.reason === "force-quit" || f.reason === "interrupted");
        } catch (ex) {
            this.loggingService.error(`[Offline Download] Failed to get the download of ${id}: ${(ex as Error).message}`);
        }
        this.clearAreaDownloadInProgress();
        return false;
    }

    /**
     * Finishes a download that a previous run of the app left, the way downloadArea finishes its own: once all
     * its files are in the cache they are moved and read into the state.
     */
    private async finishLeftBackgroundDownload(inProgress: Immutable<NonNullable<ApplicationState["offlineState"]["areaDownloadInProgress"]>>,
        result: { state: AreaDownloadState; completedFiles: string[]; failedFiles: FailedAreaFile[] }): Promise<void> {
        const { area, files: fileNames, replacedAreaIds } = inProgress;
        const id = area.properties.id;
        const currentDownload: CurrentDownload = { area, progress: 0, abortController: new AbortController() };
        this.currentDownload.set(currentDownload);
        const progressPerFile: Record<number, number> = {};
        fileNames.forEach((fileName, index) => progressPerFile[index] = result.completedFiles.includes(fileName) ? 1 : 0);
        try {
            const finalResult = result.state === "running"
                ? await this.followBackgroundDownload(currentDownload, fileNames, progressPerFile, () => Promise.resolve())
                : result;
            this.logBackgroundDownloadResult(id, finalResult);
            if (finalResult.state !== "completed" || currentDownload.abortController.signal.aborted) {
                return;
            }
            await this.completeDownload(currentDownload, [...fileNames], replacedAreaIds);
        } catch (ex) {
            this.loggingService.error(`[Offline Download] Failed to finish the download of ${id}: ${(ex as Error).message}`);
        } finally {
            if (this.isCurrent(currentDownload)) {
                this.currentDownload.set(null);
                this.clearAreaDownloadInProgress();
            }
        }
    }

    private logBackgroundDownloadResult(id: string, result: BackgroundDownloadResult): void {
        if (result.state === "completed") {
            this.loggingService.info(`[Offline Download] The background download of ${id} completed`);
            return;
        }
        this.loggingService.warning(`[Offline Download] The background download of ${id} ended ${result.state}` +
            `${result.failedFiles.length === 0 ? "" : `, missing: ${result.failedFiles.map(f => `${f.fileName} (${f.reason})`).join(", ")}`}`);
    }

    /** Forgets the area download in progress, once its files were moved or there is nothing left to move */
    private clearAreaDownloadInProgress(): void {
        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState.areaDownloadInProgress) != null) {
            this.store.dispatch(new SetAreaDownloadInProgressAction(null));
        }
    }

    /** Saves the root area with the zooms its files hold, when the root files were downloaded and may hold other zooms than before */
    private async saveRootAreaMetadataIfDownloaded(fileNames: string[]): Promise<void> {
        if (fileNames.some(fileName => OfflineFilesDownloadService.getAreaId(fileName) === OfflineAreasService.ROOT_ID)) {
            const zooms = await this.getZooms(OfflineAreasService.ROOT_ID, fileNames);
            await this.offlineAreasService.saveAreaMetadata(OfflineAreasService.createRootArea(), zooms);
        }
    }

    /**
     * The zooms the map files of an area hold together, from the lowest zoom any of them starts at to the highest any
     * of them ends at, as their headers have them. None when no map file of the area was downloaded, so that the area
     * keeps the zooms it has.
     */
    private async getZooms(id: string, fileNames: string[]): Promise<AreaZooms> {
        const zooms = await Promise.all(fileNames
            .filter(fileName => OfflineFilesDownloadService.getAreaId(fileName) === id && fileName.endsWith(".pmtiles"))
            .map(fileName => this.pmtilesService.getZooms(fileName)));
        if (zooms.length === 0) {
            return {};
        }
        return { minZoom: Math.min(...zooms.map(z => z.minZoom)), maxZoom: Math.max(...zooms.map(z => z.maxZoom)) };
    }

    /**
     * Moves the files that were downloaded to where the app reads them from, and extracts the routing
     * tiles among them. This only happens once every file of the area was downloaded, so that a download
     * that was aborted or failed leaves the files of the area as they were rather than half updated.
     * Every file is moved before any of them is handed to the routing engine, so that an engine that
     * fails can not leave the files of the area half moved, and failing to hand a file over is logged
     * and otherwise ignored: the map files of the area are whole and are drawn from as they are, and an
     * area that ended up without its routing tiles is reported as one to download again.
     * A file the routing engine did not take is deleted, since it is of no use to the app and nothing else
     * would ever clean it up - it is not one of the files the device is read for.
     */
    private async moveDownloadedFilesToDataDirectory(currentDownload: CurrentDownload, fileNames: string[]): Promise<void> {
        const id = currentDownload.area.properties.id;
        for (const fileName of fileNames) {
            await this.fileService.moveFileFromCacheToDataDirectory(fileName);
        }
        for (const fileName of fileNames) {
            const isRoutingTilesFile = RoutingProvider.isRoutingTilesFile(fileName);
            if (!isRoutingTilesFile && !RoutingProvider.isRoutingProfilesFile(fileName)) {
                continue;
            }
            try {
                if (isRoutingTilesFile) {
                    await this.routingProvider.extractOfflineRoutingTiles(fileName, id);
                } else {
                    await this.routingProvider.storeRoutingProfiles(await this.fileService.readFileInDataDirectory(fileName));
                    await this.fileService.deleteFileInDataDirectory(fileName);
                }
            } catch (ex) {
                this.loggingService.warning(`[Offline Download] Failed to hand ${fileName} to the routing engine: ${(ex as Error).message}`);
                await this.fileService.deleteFileInDataDirectory(fileName);
            }
        }
        this.loggingService.info(`[Offline Download] Moved ${fileNames.length} files of ${id} to the data directory`);
    }

    /**
     * Reports how far the download of an area got, where every one of its files weighs the same.
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
    private async getFilesToDownload(area: Immutable<OfflineArea>, downloadedFiles: Immutable<FileNameDateVersion[]> | undefined): Promise<string[]> {
        const id = area.properties.id;
        const isCompatible = downloadedFiles != null && this.getAreaCompatibility(id, downloadedFiles) === "compatible";
        if (downloadedFiles != null && !isCompatible) {
            this.loggingService.info(`[Offline Download] Asking for every file of ${id}, what it holds can not be used`);
        }
        const lastModifiedString = isCompatible ? this.getLastModifiedDate(downloadedFiles)?.toISOString() : undefined;
        const params: Record<string, string> = lastModifiedString ? { lastModified: lastModifiedString } : {};
        const request = this.httpClient.get<Record<string, string>>(`${Urls.offlineArea}/${id}`, { params });
        const fileNames = await firstValueFrom(request.pipe(timeout(5000)));
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that need to be downloaded for ${id}, ` +
            `${lastModifiedString == null ? "all of them" : `the ones that changed since ${lastModifiedString}`}`);
        return Object.keys(fileNames);
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
        this.clearAreaDownloadInProgress();
        if (this.isBackgroundDownloadAvailable) {
            const id = currentDownload.area.properties.id;
            this.offlineDownload.cancelAreaDownload({ areaId: id }).catch(ex =>
                this.loggingService.error(`[Offline Download] Failed to cancel the background download of ${id}: ${(ex as Error).message}`));
        }
    }

    /**
     * Deletes everything an area holds, its map files, its routing tiles and the file it is kept in alike. Failing
     * to remove the routing tiles is logged and otherwise ignored: the map files of the area are already gone, so
     * what the device holds has to be read again either way, and leaving the state as it was would keep an area
     * that is no longer there.
     */
    public async deleteArea(id: string): Promise<Immutable<Record<string, DownloadedArea>>> {
        this.loggingService.info(`[Offline Download] Deleting ${id}`);
        for (const { fileName } of this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[id]?.files ?? []) {
            this.loggingService.info(`[Offline Download] Deleting file ${fileName}`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
        try {
            await this.routingProvider.deleteOfflineRoutingTiles(id);
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to remove the routing tiles of ${id}: ${(ex as Error).message}`);
        }
        await this.offlineAreasService.deleteAreaMetadata(id);
        const downloadedAreas = await this.updateDownloadedAreasFromDevice();
        return OfflineAreasService.isRootId(id) ? downloadedAreas : await this.deleteUnusedRootFiles(downloadedAreas);
    }

    /** Deletes the root files once no area uses them, returns what the device holds afterwards */
    private async deleteUnusedRootFiles(downloadedAreas: Immutable<Record<string, DownloadedArea>>): Promise<Immutable<Record<string, DownloadedArea>>> {
        const ids = Object.keys(downloadedAreas);
        if (ids.includes(OfflineAreasService.ROOT_ID) && ids.every(id => OfflineAreasService.isRootId(id))) {
            return await this.deleteArea(OfflineAreasService.ROOT_ID);
        }
        return downloadedAreas;
    }

    /**
     * Moves the files of old tiles, "name+7-x-y.pmtiles", to "name+x-y.pmtiles", and the old root files, "name-6.pmtiles",
     * to "name+root.pmtiles", the names areas are kept under, and saves the metadata of the tile or of the root files
     * along with the first of their map files, with the zooms it holds.
     * Failing is logged and leaves the files that were not moved yet as they are, to be moved the next time the app starts.
     */
    private async migrateToAreas(): Promise<void> {
        try {
            const savedIds = new Set<string>();
            for (const { fileName } of await this.fileService.listOfflineFilesInDataDirectory()) {
                const tileMatch = fileName.match(OfflineFilesDownloadService.TILE_FILE_NAME_REGEX);
                const rootMatch = fileName.match(OfflineFilesDownloadService.LEGACY_ROOT_FILE_NAME_REGEX);
                let newFileName: string;
                let area: OfflineArea;
                if (tileMatch != null) {
                    const [, name, x, y, extension] = tileMatch;
                    newFileName = `${name}+${x}-${y}${extension}`;
                    area = {
                        type: "Feature",
                        properties: { id: `${x}-${y}` },
                        geometry: SpatialHelper.getTilePolygon({ x: +x, y: +y }, OfflineFilesDownloadService.TILES_ZOOM)
                    };
                } else if (rootMatch != null) {
                    newFileName = `${rootMatch[1]}+${OfflineAreasService.ROOT_ID}${rootMatch[2]}`;
                    area = OfflineAreasService.createRootArea();
                } else {
                    continue;
                }
                await this.fileService.renameFileInDataDirectory(fileName, newFileName);
                const id = area.properties.id;
                if (!savedIds.has(id) && newFileName.endsWith(".pmtiles")) {
                    savedIds.add(id);
                    this.loggingService.info(`[Offline Download] Keeping ${id} as an area`);
                    await this.offlineAreasService.saveAreaMetadata(area, await this.pmtilesService.getZooms(newFileName));
                }
            }
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to move the files that were kept before areas: ${(ex as Error).message}`);
        }
    }

    /**
     * Reads what was downloaded into the state and returns it. The state is the only place it is listed - there's nothing
     * stored that can go out of sync with the device. The map files are grouped by the area they are of, the
     * date of a file is the time it was written, which is when it was downloaded, and its version is only read
     * when it is needed, see updateVersionsOfDownloadedFiles. The areas are read from the files they are kept in
     * and the routing tiles from the routing plugin, which is what keeps them.
     * Failing to read the files is logged and otherwise ignored, leaving the state as it was.
     */
    public async updateDownloadedAreasFromDevice(): Promise<Immutable<Record<string, DownloadedArea>>> {
        const areaIdsWithRoutingTiles = await this.routingProvider.getAreasWithRoutingTiles();
        let offlineFiles: DataDirectoryFile[];
        let areas: Record<string, OfflineArea>;
        try {
            offlineFiles = await this.fileService.listOfflineFilesInDataDirectory();
            areas = await this.offlineAreasService.loadAreasMetadata();
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to read the files on the device: ${(ex as Error).message}`);
            return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        }
        const downloadedAreas: Record<string, DownloadedArea> = {};
        for (const file of offlineFiles) {
            const id = OfflineFilesDownloadService.getAreaId(file.fileName);
            if (id == null) {
                continue;
            }
            downloadedAreas[id] ??= { area: areas[id] ?? null, files: [], hasRoutingTiles: areaIdsWithRoutingTiles.includes(id) };
            downloadedAreas[id].files.push({ fileName: file.fileName, date: file.modifiedDate.toISOString() });
        }
        this.logDownloadedAreas(downloadedAreas, offlineFiles);
        this.store.dispatch(new SetDownloadedAreasAction(downloadedAreas));
        return downloadedAreas;
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
            .map(([id, { files, hasRoutingTiles }]) => `${id} ` +
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
     * Returns the given areas with the versions of their files, which are kept in the state as well.
     */
    private async updateVersionsOfDownloadedFiles(downloadedAreas: Immutable<Record<string, DownloadedArea>>): Promise<Immutable<Record<string, DownloadedArea>>> {
        if (Object.keys(this.onlineStyleRequirements.minVersionPerFile).length === 0) {
            return downloadedAreas;
        }
        const areasWithVersions: Record<string, Immutable<DownloadedArea>> = {};
        for (const [id, downloadedArea] of Object.entries(downloadedAreas)) {
            const files: Immutable<FileNameDateVersion>[] = [];
            for (const file of downloadedArea.files) {
                const sourceFileName = OfflineFilesDownloadService.getSourceFileName(file.fileName).toLowerCase();
                if (file.version != null || this.onlineStyleRequirements.minVersionPerFile[sourceFileName] == null) {
                    files.push(file);
                    continue;
                }
                files.push({ ...file, version: await this.getVersion(file.fileName) });
            }
            areasWithVersions[id] = { ...downloadedArea, files };
        }
        this.store.dispatch(new SetDownloadedAreasAction(areasWithVersions as Record<string, DownloadedArea>));
        return areasWithVersions;
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
     * removed or renamed leaves its files behind, only taking up space. Of the files of an area only those
     * of the area that is being downloaded are deleted: an area the user did not ask for keeps what it has
     * until it is downloaded itself, so that downloading one area never takes another one apart and leaves
     * the user without an area they see they have. The root files are of no area and are not shown
     * anywhere, and the styles on the device are by now the ones that were just downloaded, so nothing on
     * the device can read a source they do not have - a root file of such a source is of no use to any
     * area, downloaded or not, and goes as soon as it is found.
     * Only the offline map files are deleted, the styles and any other file that is stored in the same
     * directory are not this service's.
     */
    private async deleteFilesOfUnusedSources(id: string): Promise<void> {
        if (this.onlineStyleRequirements.sourceFileNames.length === 0) {
            this.loggingService.warning("[Offline Download] The styles have no sources, keeping all the files");
            return;
        }
        const usedSourceFileNames = [...this.onlineStyleRequirements.sourceFileNames, ...OfflineFilesDownloadService.APPLICATION_SOURCE_FILE_NAMES];
        const files = await this.fileService.listOfflineFilesInDataDirectory();
        const unusedFiles = files.filter(f => !usedSourceFileNames.includes(OfflineFilesDownloadService.getSourceFileName(f.fileName).toLowerCase()));
        for (const { fileName } of unusedFiles) {
            const fileId = OfflineFilesDownloadService.getAreaId(fileName);
            if (fileId !== id && (fileId == null || !OfflineAreasService.isRootId(fileId))) {
                continue;
            }
            const sourceFileName = OfflineFilesDownloadService.getSourceFileName(fileName).toLowerCase();
            this.loggingService.info(`[Offline Download] Deleting ${fileName}, ${sourceFileName} is not a source of the styles`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
    }

    /**
     * The downloaded areas an area replaces, which are deleted once it is downloaded: the old tiles it overlaps and the
     * areas it overlaps that the server no longer offers. An area that is offered is kept even inside another one, like
     * Berlin in Brandenburg, and so is every area when what is offered is not known.
     */
    public getReplacedAreaIds(area: Immutable<OfflineArea>, offeredAreaIds: ReadonlySet<string>): string[] {
        return Object.entries(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas))
            .filter(([id, { area: downloadedArea }]) => id !== area.properties.id && !OfflineAreasService.isRootId(id) &&
                (OfflineAreasService.isTileId(id) || (offeredAreaIds.size > 0 && !offeredAreaIds.has(id))) &&
                downloadedArea != null && SpatialHelper.intersects(downloadedArea, area))
            .map(([id]) => id);
    }

    /** The time the newest file of an area was downloaded at, which is when the area was last updated */
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
     * How usable the files of an area still are: they are "outdated" when only the style that was just
     * downloaded asks for more than they hold, which leaves the map drawn as it always was until they
     * are downloaded again, and "unusable" when the styles that are already on the device ask for more,
     * which is what makes the map itself come out wrong.
     */
    public getAreaCompatibility(id: string, files: Immutable<FileNameDateVersion[]>): AreaCompatibility {
        if (!this.meetsRequirements(id, files, this.offlineStyleRequirements)) {
            return "unusable";
        }
        if (!this.meetsRequirements(id, files, this.onlineStyleRequirements) || !this.hasRoutingTiles(id)) {
            return "outdated";
        }
        return "compatible";
    }

    /**
     * Whether the routing tiles of an area are on the device. An area without them is only out of date and not
     * unusable, since its map is still drawn from the files it has. The root files have no routing tiles of their own.
     */
    private hasRoutingTiles(id: string): boolean {
        if (OfflineAreasService.isRootId(id)) {
            return true;
        }
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[id]?.hasRoutingTiles === true;
    }

    /**
     * The names of the source files an area is expected to hold. The server decides which source has files
     * of its own per area and which only has root files - the elevation source, for example, has no root
     * file - so rather than assume, this takes the sources the styles use and keeps the ones that are
     * actually downloaded for areas of the same kind, root or not, as any other area on the device shows.
     */
    private getExpectedSourceFileNames(id: string, requirements: StyleRequirements): string[] {
        const downloadedSourceFileNames = new Set<string>();
        for (const [otherAreaId, { files: otherFiles }] of Object.entries(this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas))) {
            if (OfflineAreasService.isRootId(otherAreaId) !== OfflineAreasService.isRootId(id)) {
                continue;
            }
            for (const { fileName } of otherFiles) {
                downloadedSourceFileNames.add(OfflineFilesDownloadService.getSourceFileName(fileName).toLowerCase());
            }
        }
        return requirements.sourceFileNames.filter(sourceFileName => downloadedSourceFileNames.has(sourceFileName));
    }

    /**
     * Whether the files of an area are still the ones a style can be drawn with: it has a file of every
     * source the style uses, none of a source it no longer uses, and they are all new enough for it.
     * A source that was renamed shows up as both - the file of the old name is of no source of the style
     * and the new name has no file at all - and either way the area can not be drawn and has to be
     * downloaded again. A file the style requires a version from but that has none, or that can not be read,
     * is treated as too old.
     */
    private meetsRequirements(id: string, files: Immutable<FileNameDateVersion[]>, requirements: StyleRequirements): boolean {
        return this.getUnmetRequirement(id, files, requirements) == null;
    }

    /**
     * What keeps the files of an area from being drawn with a style, in words, or null when nothing does.
     * It says it rather than writes it to the log, since this is asked for every area that is drawn on the
     * offline management screen every time anything on it changes - only the reasons that are worth
     * telling about are written, see initialize.
     */
    private getUnmetRequirement(id: string, files: Immutable<FileNameDateVersion[]>, requirements: StyleRequirements): string | null {
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
        for (const sourceFileName of this.getExpectedSourceFileNames(id, requirements)) {
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
