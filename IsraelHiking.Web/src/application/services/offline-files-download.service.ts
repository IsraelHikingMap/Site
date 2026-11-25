import { computed, inject, Service, signal } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { Immutable } from "immer";
import type { StyleSpecification, VectorSourceSpecification } from "maplibre-gl";

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
 * How usable the files of an area still are, see getAreaCompatibility. "outdated" only means that a newer
 * style wants more than they hold, while "unusable" means the map is already drawn wrong without them.
 */
export type AreaCompatibility = "compatible" | "outdated" | "unusable";

/** The download that is going on right now, everything that lives as long as it does */
type CurrentDownload = {
    /** The areas that are downloaded, in the order they were asked for, with how far each of them got */
    areas: DownloadInProgress[];
    /** Identifies the download - a new one gets a new controller, and only it can abort it */
    abortController: AbortController;
};

/**
 * A file the server listed for one of the areas that are downloaded. A root file is listed for every area and is
 * downloaded once, as a file of the first area that listed it.
 */
type AreaFile = { fileName: string; areaId: string };

export type DownloadStatus = "up-to-date" | "downloaded" | "error" | "aborted";

/** An area to download along with the downloaded areas it replaces, which are deleted once it is downloaded, see getReplacedAreaIds */
export type AreaToDownload = { area: Immutable<OfflineArea>; replacedAreaIds: string[] };

/** An area that is being downloaded and how much of it was downloaded so far, from 0 to 100 */
export type DownloadInProgress = { area: Immutable<OfflineArea>; progress: number };

@Service()
export class OfflineFilesDownloadService {
    /** The metadata id a style uses to declare the minimal version it needs from one of its sources */
    private static readonly MIN_VERSION_KEY_REGEX = /^sources:(.+):min-version$/;

    /**
     * Sources the app adds by itself instead of taking them from the style, see the public pois component.
     * Their files are downloaded and needed like the files of the style's own sources.
     */
    private static readonly APPLICATION_SOURCE_FILE_NAMES = ["global_points"];

    /** Sources whose name contains this are not downloaded for offline usage, the contours are made from the DEM */
    private static readonly CONTOUR = "contour";

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

    /** What the styles that were downloaded now need from the offline files, read every time they are downloaded */
    private onlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    /**
     * What the styles that are already on the device need. They are what the map is drawn with when there
     * is no network, and they are only replaced once every area can be drawn with them, so an area that
     * does not meet them is one the app can not draw correctly right now.
     */
    private offlineStyleRequirements: StyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
    private readonly currentDownload = signal<CurrentDownload | null>(null);

    /** The areas that are being downloaded right now and how far each of them got, empty when there is no download */
    public readonly downloadsInProgress = computed<DownloadInProgress[]>(() => this.currentDownload()?.areas ?? []);

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
            const hasIncompatibleAreas = this.logIncompatibleAreas(downloadedAreas);
            const needToAskToRedownload = Object.keys(downloadedAreas).length === 0 || hasIncompatibleAreas;
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
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to check if the areas need to be downloaded again: ${(ex as Error).message}`);
        }
    }

    /** Logs the areas that need to be downloaded again and why, returns whether there are any */
    private logIncompatibleAreas(downloadedAreas: Immutable<Record<string, DownloadedArea>>): boolean {
        const incompatibleAreas = Object.entries(downloadedAreas).filter(([areaId, { files }]) =>
            !OfflineAreasService.isRootId(areaId) && this.getAreaCompatibility(areaId, files) !== "compatible");
        for (const [areaId, { files }] of incompatibleAreas) {
            this.loggingService.warning(`[Offline Download] ${areaId} needs to be downloaded again, ${this.describeIncompatibility(areaId, files)}`);
        }
        return incompatibleAreas.length > 0;
    }

    /** Why an area is not compatible, in words, for the log */
    private describeIncompatibility(areaId: string, files: Immutable<FileNameDateVersion[]>): string {
        const reason = this.getUnmetRequirement(areaId, files, this.offlineStyleRequirements)
            ?? this.getUnmetRequirement(areaId, files, this.onlineStyleRequirements)
            ?? "there are no routing tiles";
        return `it is ${this.getAreaCompatibility(areaId, files)}: ${reason}`;
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
            styles.push({ fileName: baseLayerUrl.split("/").at(-1), content: style });
        }
        this.onlineStyleRequirements = { minVersionPerFile: {}, sourceFileNames: [] };
        for (const style of styles) {
            this.readStyleRequirements(JSON.parse(style.content) as StyleSpecification, this.onlineStyleRequirements);
        }
        return styles;
    }

    /**
     * A style declares the minimal version it needs from a source using a "sources:{name}:min-version" metadata
     * key, but the offline files are named after the address of the source's tiles and not after the name of
     * the source in the style - the "IHM" source, for example, is downloaded as "IHM-schema+{id}.pmtiles".
     * This translates every such key to the name of the file it refers to, accepting a key that is written using
     * either name, so that a mismatch between the two does not silently skip the version check.
     * When both styles require a version from the same file the stricter one wins.
     */
    private readStyleRequirements(style: StyleSpecification, requirements: StyleRequirements): void {
        const fileNamePerSourceName: Record<string, string> = {};
        for (const [sourceName, source] of Object.entries(style.sources ?? {})) {
            const fileName = OfflineFilesDownloadService.getFileNameOfSource(source as VectorSourceSpecification);
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
     * The last part of the address of a source's tiles before the zoom, which is also the name the server gives the
     * offline files of that source: "https://mapeak.com/vector/data/IHM-schema/{z}/{x}/{y}.mvt" is "IHM-schema".
     */
    private static getFileNameOfSource({ tiles }: VectorSourceSpecification): string | null {
        const lastPart = (tiles?.[0] ?? "").split("/{z}")[0].split("/").at(-1);
        return lastPart || null;
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
     * Downloads everything the areas need, each area in a batch of the downloader plugin of its own. All the batches are
     * handed to the plugin together, which downloads a few files at a time in the order they were given and goes on from
     * one area to the next while the app is in the background. An area is written to the device as soon as all of its
     * files are whole, one area at a time, and an area that failed leaves the others as they are. A download that is still
     * going on when this is called is aborted first, so that the one the user asked for last is the only one that goes on.
     * Returns what happened to each area, in the order they were given.
     */
    public async downloadAreas(areasToDownload: AreaToDownload[]): Promise<DownloadStatus[]> {
        this.abortCurrentDownload();
        const areas = areasToDownload.map(({ area }) => area);
        const currentDownload: CurrentDownload = { areas: areas.map(area => ({ area, progress: 0 })), abortController: new AbortController() };
        this.currentDownload.set(currentDownload);
        const areaIds = areas.map(area => area.properties.id);
        this.loggingService.info(`[Offline Download] Starting downloading the offline files of ${areaIds.join(", ")}`);
        try {
            let files: AreaFile[];
            let alreadyDownloaded: string[];
            try {
                const styles = await this.downloadStyleAndUpdateMetadata();
                await this.writeStylesToDevice(styles);
                for (const areaId of areaIds) {
                    await this.deleteFilesOfUnusedSources(areaId);
                }
                files = await this.getFilesOfAreas(areas, await this.updateDownloadedAreasFromDevice());
                alreadyDownloaded = await this.fileService.listFilesInOfflineCache();
            } catch (ex) {
                const status = this.getFailureStatus(currentDownload, areaIds.join(", "), ex);
                return areas.map(() => status);
            }
            let installs = Promise.resolve();
            return await Promise.all(areasToDownload.map(async areaToDownload => {
                const areaId = areaToDownload.area.properties.id;
                const areaFiles = files.filter(file => file.areaId === areaId);
                try {
                    if (areaFiles.length === 0) {
                        this.loggingService.info(`[Offline Download] No files to download for ${areaId}, all files are up to date`);
                        return "up-to-date";
                    }
                    await this.downloadAreaFiles(currentDownload, areaToDownload.area, areaFiles, alreadyDownloaded);
                    if (currentDownload.abortController.signal.aborted) {
                        return "aborted";
                    }
                    const install = installs.then(() => this.installArea(areaToDownload, areaFiles));
                    installs = install.catch(() => { });
                    await install;
                    return "downloaded";
                } catch (ex) {
                    return this.getFailureStatus(currentDownload, areaId, ex);
                } finally {
                    this.removeFromProgress(currentDownload, areaId);
                }
            }));
        } finally {
            // A download that was aborted might only get here after the next one started, and it is not its to clear
            if (this.isCurrent(currentDownload)) {
                this.currentDownload.set(null);
            }
        }
    }

    /**
     * What a download that threw ended with. Aborting makes whatever was going on at that moment fail, which is not an
     * error. A failure is logged with what it failed on rather than with a status code alone: a request that got no
     * answer is the connection and not the server, which is how a download of hundreds of megabytes fails when it drops,
     * and calling that a server side error sends whoever reads the log the wrong way.
     */
    private getFailureStatus(currentDownload: CurrentDownload, what: string, ex: unknown): DownloadStatus {
        if (currentDownload.abortController.signal.aborted) {
            this.loggingService.info(`[Offline Download] The download of ${what} was aborted while it was going on`);
            return "aborted";
        }
        const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
        const reason = typeAndMessage.type === "timeout"
            ? "a timeout"
            : typeAndMessage.statusCode != null
                ? `the server answering with ${typeAndMessage.statusCode}`
                : "a request that got no answer, i.e. the connection and not the server";
        this.loggingService.error(`[Offline Download] The download of ${what} failed due to ${reason}: ${typeAndMessage.message}`);
        return "error";
    }

    /**
     * Writes an area whose files are whole to the device and deletes the areas it replaces. A replaced area another area
     * that was downloaded along with it already deleted is skipped.
     */
    private async installArea({ area, replacedAreaIds }: AreaToDownload, files: AreaFile[]): Promise<void> {
        await this.moveDownloadedFilesToDataDirectory(files);
        const fileNames = files.map(file => file.fileName);
        await this.offlineAreasService.saveAreaMetadata(area, await this.getZooms(area.properties.id, fileNames));
        await this.saveRootAreaMetadataIfDownloaded(fileNames);
        for (const replacedAreaId of replacedAreaIds) {
            if (this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[replacedAreaId] != null) {
                await this.deleteArea(replacedAreaId);
            }
        }
        const downloadedAreas = await this.updateDownloadedAreasFromDevice();
        const areasWithVersions = await this.updateVersionsOfDownloadedFiles(downloadedAreas);
        this.logIncompatibleAreas(areasWithVersions);
    }

    /**
     * The files the server lists for the areas, area after area, where a file listed by more than one area, a root file,
     * is taken once, as a file of the first area that listed it, so that only one batch downloads it.
     */
    private async getFilesOfAreas(areas: Immutable<OfflineArea>[], downloadedAreas: Immutable<Record<string, DownloadedArea>>): Promise<AreaFile[]> {
        const files: AreaFile[] = [];
        for (const area of areas) {
            const areaId = area.properties.id;
            for (const fileName of await this.getFilesToDownload(area, downloadedAreas[areaId]?.files)) {
                if (!files.some(file => file.fileName === fileName)) {
                    files.push({ fileName, areaId });
                }
            }
        }
        return files;
    }

    /**
     * Downloads the files of one area into the cache, where a download that was aborted or failed leaves the files it
     * finished, so that downloading the area again continues from there instead of starting over. A file that is already
     * whole in the cache is not downloaded again and counts as downloaded in the progress. The notification is titled with the name of the area.
     */
    private async downloadAreaFiles(currentDownload: CurrentDownload, area: Immutable<OfflineArea>, files: AreaFile[], alreadyDownloaded: string[]): Promise<void> {
        const filesToDownload = files.filter(file => !alreadyDownloaded.includes(file.fileName));
        const skippedCount = files.length - filesToDownload.length;
        this.loggingService.info(`[Offline Download] Downloading ${filesToDownload.length} files of ${area.properties.id}` +
            (skippedCount > 0 ? `, skipping ${skippedCount} that were already downloaded recently` : ""));
        if (filesToDownload.length === 0) {
            return;
        }
        const name = this.offlineAreasService.getName(area) ?? area.properties.id;
        const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
        const fileProgress = filesToDownload.map(() => 0);
        await this.fileService.downloadFilesToCacheAuthenticated(
            filesToDownload.map(({ fileName, areaId }) => ({ url: `${Urls.offlineArea}/${areaId}/${fileName}`, fileName })),
            token,
            name,
            (fileIndex, progress) => {
                fileProgress[fileIndex] = progress;
                const sum = fileProgress.reduce((total, value) => total + value, skippedCount);
                this.updateProgress(currentDownload, area.properties.id, sum / files.length);
            },
            currentDownload.abortController);
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
    private async getZooms(areaId: string, fileNames: string[]): Promise<AreaZooms> {
        const zooms = await Promise.all(fileNames
            .filter(fileName => OfflineFilesDownloadService.getAreaId(fileName) === areaId && fileName.endsWith(".pmtiles"))
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
    private async moveDownloadedFilesToDataDirectory(files: AreaFile[]): Promise<void> {
        for (const { fileName } of files) {
            await this.fileService.moveFileFromCacheToDataDirectory(fileName);
        }
        for (const { fileName, areaId } of files) {
            const isRoutingTilesFile = RoutingProvider.isRoutingTilesFile(fileName);
            if (!isRoutingTilesFile && !RoutingProvider.isRoutingProfilesFile(fileName)) {
                continue;
            }
            try {
                if (isRoutingTilesFile) {
                    await this.routingProvider.extractOfflineRoutingTiles(fileName, areaId);
                } else {
                    await this.routingProvider.storeRoutingProfiles(await this.fileService.readFileInDataDirectory(fileName));
                    await this.fileService.deleteFileInDataDirectory(fileName);
                }
            } catch (ex) {
                this.loggingService.warning(`[Offline Download] Failed to hand ${fileName} to the routing engine: ${(ex as Error).message}`);
                await this.fileService.deleteFileInDataDirectory(fileName);
            }
        }
        this.loggingService.info(`[Offline Download] Moved ${files.length} files to the data directory`);
    }

    /**
     * Reports how far the download of one of the areas got, from 0 to 1. A download that is no longer the current one has
     * nothing to report - its files might still be coming in after it was aborted, and that says nothing about the
     * download that took its place.
     */
    private updateProgress(currentDownload: CurrentDownload, areaId: string, progress: number) {
        if (!this.isCurrent(currentDownload)) {
            return;
        }
        const latest = this.currentDownload();
        this.currentDownload.set({
            ...latest,
            areas: latest.areas.map(area => area.area.properties.id === areaId ? { ...area, progress: progress * 100.0 } : area)
        });
    }

    /**
     * Takes an area whose download ended out of the areas in progress, so that it is shown as what it ended as - downloaded,
     * or as it was before - while the other areas are still downloading.
     */
    private removeFromProgress(currentDownload: CurrentDownload, areaId: string) {
        if (!this.isCurrent(currentDownload)) {
            return;
        }
        const latest = this.currentDownload();
        this.currentDownload.set({ ...latest, areas: latest.areas.filter(({ area }) => area.properties.id !== areaId) });
    }

    /** Whether the given download is the one that is going on, they are told apart by their controller */
    private isCurrent(currentDownload: CurrentDownload): boolean {
        return this.currentDownload()?.abortController === currentDownload.abortController;
    }

    /**
     * Asks the server which of the files of an area need downloading, along with the root files, named the way they
     * are kept on the device. The root files are asked for by the date of the area, which lists them with almost
     * every download, since they are small and that is simpler than asking for them on their own.
     */
    private async getFilesToDownload(area: Immutable<OfflineArea>, downloadedFiles: Immutable<FileNameDateVersion[]> | undefined): Promise<string[]> {
        const areaId = area.properties.id;
        const isCompatible = downloadedFiles != null && this.getAreaCompatibility(areaId, downloadedFiles) === "compatible";
        if (downloadedFiles != null && !isCompatible) {
            this.loggingService.info(`[Offline Download] Asking for every file of ${areaId}, ${this.describeIncompatibility(areaId, downloadedFiles)}`);
        }
        const lastModifiedString = isCompatible ? this.getLastModifiedDate(downloadedFiles)?.toISOString() : undefined;
        const params: Record<string, string> = lastModifiedString ? { lastModified: lastModifiedString } : {};
        const request = this.httpClient.get<Record<string, string>>(`${Urls.offlineArea}/${areaId}`, { params });
        const fileNames = await firstValueFrom(request.pipe(timeout(5000)));
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that need to be downloaded for ${areaId}, ` +
            `${lastModifiedString == null ? "all of them" : `the ones that changed since ${lastModifiedString}`}`);
        return Object.keys(fileNames);
    }

    public abortCurrentDownload(): void {
        const currentDownload = this.currentDownload();
        if (currentDownload == null) {
            return;
        }
        // Every download has an abort controller of its own, so aborting one never touches the next
        this.loggingService.info("[Offline Download] Aborting the download of " + currentDownload.areas.map(({ area }) => area.properties.id).join(", "));
        currentDownload.abortController.abort();
        this.currentDownload.set(null);
    }

    /**
     * Deletes everything an area holds, its map files, its routing tiles and the file it is kept in alike. Failing
     * to remove the routing tiles is logged and otherwise ignored: the map files of the area are already gone, so
     * what the device holds has to be read again either way, and leaving the state as it was would keep an area
     * that is no longer there.
     */
    public async deleteArea(areaId: string): Promise<Immutable<Record<string, DownloadedArea>>> {
        this.loggingService.info(`[Offline Download] Deleting ${areaId}`);
        for (const { fileName } of this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[areaId]?.files ?? []) {
            this.loggingService.info(`[Offline Download] Deleting file ${fileName}`);
            await this.fileService.deleteFileInDataDirectory(fileName);
            this.pmtilesService.invalidateFile(fileName);
        }
        try {
            await this.routingProvider.deleteOfflineRoutingTiles(areaId);
        } catch (ex) {
            this.loggingService.warning(`[Offline Download] Failed to remove the routing tiles of ${areaId}: ${(ex as Error).message}`);
        }
        await this.offlineAreasService.deleteAreaMetadata(areaId);
        const downloadedAreas = await this.updateDownloadedAreasFromDevice();
        return OfflineAreasService.isRootId(areaId) ? downloadedAreas : await this.deleteUnusedRootFiles(downloadedAreas);
    }

    /** Deletes the root files once no area uses them, returns what the device holds afterwards */
    private async deleteUnusedRootFiles(downloadedAreas: Immutable<Record<string, DownloadedArea>>): Promise<Immutable<Record<string, DownloadedArea>>> {
        const areaIds = Object.keys(downloadedAreas);
        if (areaIds.includes(OfflineAreasService.ROOT_ID) && areaIds.every(areaId => OfflineAreasService.isRootId(areaId))) {
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
            const savedAreaIds = new Set<string>();
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
                const areaId = area.properties.id;
                if (!savedAreaIds.has(areaId) && newFileName.endsWith(".pmtiles")) {
                    savedAreaIds.add(areaId);
                    this.loggingService.info(`[Offline Download] Keeping ${areaId} as an area`);
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
            const areaId = OfflineFilesDownloadService.getAreaId(file.fileName);
            if (areaId == null) {
                continue;
            }
            downloadedAreas[areaId] ??= { area: areas[areaId] ?? null, files: [], hasRoutingTiles: areaIdsWithRoutingTiles.includes(areaId) };
            downloadedAreas[areaId].files.push({ fileName: file.fileName, date: file.modifiedDate.toISOString() });
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
            .map(([areaId, { files }]) => `${areaId} (${files.map(({ fileName }) => OfflineFilesDownloadService.getSourceFileName(fileName)).join(", ")})`).join(", ")}`);
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
        for (const [areaId, downloadedArea] of Object.entries(downloadedAreas)) {
            const files: Immutable<FileNameDateVersion>[] = [];
            for (const file of downloadedArea.files) {
                const sourceFileName = OfflineFilesDownloadService.getSourceFileName(file.fileName).toLowerCase();
                if (file.version != null || this.onlineStyleRequirements.minVersionPerFile[sourceFileName] == null) {
                    files.push(file);
                    continue;
                }
                files.push({ ...file, version: await this.getVersion(file.fileName) });
            }
            areasWithVersions[areaId] = { ...downloadedArea, files };
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
    private async deleteFilesOfUnusedSources(areaId: string): Promise<void> {
        if (this.onlineStyleRequirements.sourceFileNames.length === 0) {
            this.loggingService.warning("[Offline Download] The styles have no sources, keeping all the files");
            return;
        }
        const usedSourceFileNames = OfflineFilesDownloadService.getOfflineSourceFileNames(this.onlineStyleRequirements);
        const files = await this.fileService.listOfflineFilesInDataDirectory();
        const unusedFiles = files.filter(f => !usedSourceFileNames.includes(OfflineFilesDownloadService.getSourceFileName(f.fileName).toLowerCase()));
        for (const { fileName } of unusedFiles) {
            const fileAreaId = OfflineFilesDownloadService.getAreaId(fileName);
            if (fileAreaId !== areaId && (fileAreaId == null || !OfflineAreasService.isRootId(fileAreaId))) {
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
            .filter(([areaId, { area: downloadedArea }]) => areaId !== area.properties.id && !OfflineAreasService.isRootId(areaId) &&
                (OfflineAreasService.isTileId(areaId) || (offeredAreaIds.size > 0 && !offeredAreaIds.has(areaId))) &&
                downloadedArea != null && SpatialHelper.intersects(downloadedArea, area))
            .map(([areaId]) => areaId);
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
    public getAreaCompatibility(areaId: string, files: Immutable<FileNameDateVersion[]>): AreaCompatibility {
        if (!this.meetsRequirements(areaId, files, this.offlineStyleRequirements)) {
            return "unusable";
        }
        if (!this.meetsRequirements(areaId, files, this.onlineStyleRequirements) || !this.hasRoutingTiles(areaId)) {
            return "outdated";
        }
        return "compatible";
    }

    /**
     * Whether the routing tiles of an area are on the device. An area without them is only out of date and not
     * unusable, since its map is still drawn from the files it has. The root files have no routing tiles of their own.
     */
    private hasRoutingTiles(areaId: string): boolean {
        if (OfflineAreasService.isRootId(areaId)) {
            return true;
        }
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[areaId]?.hasRoutingTiles === true;
    }

    /**
     * The names of the source files that are downloaded for an area, which have to be the ones the server lists, see
     * GetSourceNamesFromStyle there: the sources of the styles without the contours and with the global points.
     */
    private static getOfflineSourceFileNames(requirements: StyleRequirements): string[] {
        return [
            ...requirements.sourceFileNames.filter(name => !name.includes(OfflineFilesDownloadService.CONTOUR)),
            ...OfflineFilesDownloadService.APPLICATION_SOURCE_FILE_NAMES
        ];
    }

    /**
     * Whether the files of an area are still the ones a style can be drawn with: it has a file of every
     * source the style uses, none of a source it no longer uses, and they are all new enough for it.
     * A source that was renamed shows up as both - the file of the old name is of no source of the style
     * and the new name has no file at all - and either way the area can not be drawn and has to be
     * downloaded again. A file the style requires a version from but that has none, or that can not be read,
     * is treated as too old.
     */
    private meetsRequirements(areaId: string, files: Immutable<FileNameDateVersion[]>, requirements: StyleRequirements): boolean {
        return this.getUnmetRequirement(areaId, files, requirements) == null;
    }

    /**
     * What keeps the files of an area from being drawn with a style, in words, or null when nothing does.
     * The root files are not checked for missing ones, since which sources have one is only known to the server.
     * It says it rather than writes it to the log, since this is asked for every area that is drawn on the
     * offline management screen every time anything on it changes - only the reasons that are worth
     * telling about are written, see initialize.
     */
    private getUnmetRequirement(areaId: string, files: Immutable<FileNameDateVersion[]>, requirements: StyleRequirements): string | null {
        if (requirements.sourceFileNames.length === 0) {
            return null; // Nothing was read from the styles, so there is nothing to hold the files against
        }
        const sourceFileNamesOfTile = new Set(files.map(
            f => OfflineFilesDownloadService.getSourceFileName(f.fileName).toLowerCase()));
        const offlineSourceFileNames = OfflineFilesDownloadService.getOfflineSourceFileNames(requirements);
        for (const sourceFileName of sourceFileNamesOfTile) {
            if (!offlineSourceFileNames.includes(sourceFileName)) {
                return `${sourceFileName} is not a source that is downloaded for the style`;
            }
        }
        for (const sourceFileName of OfflineAreasService.isRootId(areaId) ? [] : offlineSourceFileNames) {
            if (!sourceFileNamesOfTile.has(sourceFileName)) {
                return `there is no file of ${sourceFileName}, which is needed offline`;
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
