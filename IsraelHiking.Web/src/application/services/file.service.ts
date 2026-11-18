import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { last } from "lodash-es";
import { firstValueFrom, timeout } from "rxjs";
import { zipSync, strToU8 } from "fflate";
import { CapacitorDownloader } from "@capgo/capacitor-downloader";

import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { MapService } from "./map.service";
import { SpatialHelper } from "./spatial.helper";
import { LoggingService } from "./logging.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { ElevationProvider } from "./elevation.provider";
import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";
import type { DataContainer } from "../models";

/** What a style that can not be found anywhere is replaced with - an empty map. */
const EMPTY_STYLE = JSON.stringify({ version: 8, layers: [], sources: {} });

/**
 * Downloads a blob under the given file name using the anchor "download" attribute,
 * which is supported by every browser this app targets.
 */
const saveAs = (blob: Blob, fileName: string) => {
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = fileName;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    // Revoking straight away can cancel the download in some browsers, so give it time to start
    setTimeout(() => URL.revokeObjectURL(url), 40000);
};

export type FormatViewModel = {
    label: string;
    outputFormat: string;
    extension: string;
};

/**
 * A synthetic stand-in for a file `<input>` change / drop event, used when files are
 * obtained outside the DOM (e.g. from the native camera). `target` is null because
 * there is no input element to read files from or to reset afterwards.
 */
export type HTMLElementInputChangeEvent = {
    dataTransfer: { files: File[] };
    target: HTMLInputElement | null;
    preventDefault(): void;
    stopPropagation(): void;
};

/** Reports how much of one of the files was downloaded, from 0 to 1, by the index of that file in the files that are downloaded */
export type FileDownloadProgressCallback = (fileIndex: number, progress: number) => void;

/** A file to download into the offline files cache, see downloadFilesToCacheAuthenticated */
export type OfflineFileToDownload = {
    url: string;
    fileName: string;
};

/** A file in the app's data directory, the time it was last written to and its size in bytes */
export type DataDirectoryFile = {
    fileName: string;
    modifiedDate: Date;
    size: number;
};

@Service()
export class FileService {
    /**
     * The offline files are downloaded into their own directory in the cache, so that they can be
     * cleared without touching anything else that is cached.
     */
    private static readonly OFFLINE_CACHE_DIRECTORY = "offline-files";

    /** The extension of the offline map files an offline download leaves in the data directory. */
    private static readonly OFFLINE_FILE_EXTENSION = ".pmtiles";

    /** Tells the batches of the downloader plugin apart, so that the events of an aborted one are not taken for those of the next */
    private static batchCounter = 0;

    /**
     * How long a style is waited for when there is a copy of it on the device to draw instead - a network that
     * takes longer than this to answer is not worth leaving the map empty for.
     */
    private static readonly STYLE_TIMEOUT_WITH_COPY_MS = 1500;

    /** How long a style is waited for when there is nothing on the device to draw while waiting. */
    private static readonly STYLE_TIMEOUT_WITHOUT_COPY_MS = 5000;

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly mapService = inject(MapService);
    private readonly gpxDataContainerConverterService = inject(GpxDataContainerConverterService);
    private readonly loggingService = inject(LoggingService);
    private readonly elevationProvider = inject(ElevationProvider);
    private readonly resources = inject(ResourcesService);

    public readonly formats: FormatViewModel[] = [
        {
            label: "GPX version 1.1 (.gpx)",
            extension: "gpx",
            outputFormat: "gpx"
        },
        {
            label: "Single track GPX (.gpx)",
            extension: "gpx",
            outputFormat: "gpx_single_track"
        },
        {
            label: "Single route GPX (.gpx)",
            extension: "gpx",
            outputFormat: "gpx_route"
        },
        {
            label: "Keyhole markup language (.kml)",
            extension: "kml",
            outputFormat: "kml"
        },
        {
            label: "Comma-separated values (.csv)",
            extension: "csv",
            outputFormat: "csv"
        },
        {
            label: "Naviguide binary route file (.twl)",
            extension: "twl",
            outputFormat: "twl"
        }
    ];

    public getFilesFromEvent(e: Event | DragEvent | HTMLElementInputChangeEvent): File[] {
        let files: File[] | FileList | null | undefined;

        if ("dataTransfer" in e && e.dataTransfer) {
            files = e.dataTransfer.files;
        } else {
            const target = e.target as HTMLInputElement | null;
            files = target?.files;
        }
        if (!files || files.length === 0) {
            return [];
        }
        const filesToReturn = [];

        for (const file of files) {
            filesToReturn.push(file);
        }
        const target = e.target as HTMLInputElement | null;
        if (target) {
            target.value = "";
        }
        return filesToReturn;
    }

    /**
     * Gets a style from the network, so that a style that changed online is never missed.
     * What is on the device - the built in base style an offline download wrote, the kept copy of every
     * other style - is what is drawn when the network can not be reached, and the network is given less time
     * to answer when there is such a copy.
     */
    public async getStyleJsonContent(url: string, isBuiltInBaseLayer: boolean): Promise<string> {
        if (this.runningContextService.isCapacitor && url.startsWith(".")) {
            const styleOnDevice = await this.readStyleFile(last(url.split("/")), Directory.Data);
            if (styleOnDevice == null) {
                this.loggingService.error(`[Files] Missing local style file: ${url}`);
                return EMPTY_STYLE;
            }
            return styleOnDevice;
        }
        const startTime = performance.now();
        const styleOnDevice = isBuiltInBaseLayer
            ? await this.readStyleFile(last(url.split("/")), Directory.Data)
            : await this.readStyleFile(FileService.getStyleCacheFileName(url), Directory.Cache);
        const timeoutMs = styleOnDevice != null ? FileService.STYLE_TIMEOUT_WITH_COPY_MS : FileService.STYLE_TIMEOUT_WITHOUT_COPY_MS;
        try {
            const styleText = await firstValueFrom(this.httpClient.get(url, { responseType: "text" }).pipe(timeout(timeoutMs)));
            if (!isBuiltInBaseLayer) {
                await this.keepStyleInCache(url, styleText);
            }
            return styleText;
        } catch (ex) {
            const failure = `after ${Math.round(performance.now() - startTime)} ms: ${(ex as Error).message}`;
            if (styleOnDevice != null) {
                this.loggingService.info(`[Files] Drawing ${url} with the style on the device, it could not be fetched ${failure}`);
                return styleOnDevice;
            }
            this.loggingService.error(`[Files] There is no style to draw ${url} with, it could not be fetched ${failure}`);
            return EMPTY_STYLE;
        }
    }

    /** The style of a base layer as it is on the device, an empty style when it is not there. */
    public async getStyleJsonContentFromDevice(url: string): Promise<string> {
        return await this.readStyleFile(last(url.split("/")), Directory.Data) ?? EMPTY_STYLE;
    }

    /**
     * The name a fetched style is kept under, at the cache root, where the offline files download never looks.
     * It is the escaped url since two styles of different repositories are both called "style.json".
     */
    private static getStyleCacheFileName(url: string): string {
        return `style-cache-${encodeURIComponent(url)}`;
    }

    private async keepStyleInCache(url: string, styleText: string): Promise<void> {
        if (!this.runningContextService.isCapacitor) {
            return;
        }
        try {
            await Filesystem.writeFile({
                path: FileService.getStyleCacheFileName(url),
                data: styleText,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });
        } catch (ex) {
            this.loggingService.warning(`[Files] Unable to keep a copy of the style ${url}: ${(ex as Error).message}`);
        }
    }

    /**
     * Reads a style that is on the device, null when there is none under that name.
     */
    private async readStyleFile(styleFileName: string, directory: Directory): Promise<string | null> {
        if (!this.runningContextService.isCapacitor) {
            return null;
        }
        try {
            const file = await Filesystem.readFile({
                path: styleFileName,
                directory,
                encoding: Encoding.UTF8
            });
            return file.data as string;
        } catch {
            return null;
        }
    }

    private async base64StringToBlob(base64: string, type = "application/octet-stream"): Promise<Blob> {
        const response = await fetch(`data:${type};base64,${base64}`);
        return response.blob();
    }

    public async saveToFile(fileName: string, format: string, dataContainer: DataContainer) {
        const responseData = format === "gpx"
            ? await this.gpxDataContainerConverterService.toGpx(dataContainer)
            : await firstValueFrom(this.httpClient.post<string>(Urls.files + "?format=" + format, dataContainer));

        if (!this.runningContextService.isCapacitor) {
            const blobToSave = await this.base64StringToBlob(responseData);
            saveAs(blobToSave, fileName);
            return;
        }
        fileName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
        const fileUrl = await this.storeFileToCache(fileName, responseData, true);
        Share.share({
            files: [fileUrl]
        });
    }

    public async saveLogToZipFile(fileName: string, content: string) {
        const result = zipSync({ "log.txt": strToU8(content) });
        const resultBlob = new Blob([result as Uint8Array<ArrayBuffer>], { type: "application/zip" });
        saveAs(resultBlob, fileName);
    }

    public async getFileFromUrl(url: string, type?: string): Promise<File> {
        const fileResponse = await Filesystem.readFile({
            path: url
        });
        const base64Content = fileResponse.data as string;
        const fileName = await this.getFileName(url, base64Content);
        type = type || this.getTypeFromUrl(fileName);
        const blob = await this.base64StringToBlob(base64Content, type);
        return new File([blob], fileName, { type });
    }

    private async getFileName(url: string, base64Content: string): Promise<string> {
        let name: string = null;
        try {
            name = (await Filesystem.stat({ path: url })).name;
        } catch (ex) {
            // Some content providers, mainly mail apps, do not supply a display name for the file they share,
            // which causes stat to fail, in that case the name needs to be resolved from the url and content.
            this.loggingService.warning(`[Files] Unable to get the file name using stat: ${url}, ${(ex as Error).message}`);
        }
        if (!name) {
            name = this.decodeUrlPart(last(url.split("/"))) || "file";
        }
        if (name.indexOf(".") === -1) {
            name += this.getExtensionFromContent(base64Content);
        }
        return name;
    }

    private decodeUrlPart(urlPart: string): string {
        try {
            return decodeURIComponent(urlPart || "");
        } catch {
            return urlPart || "";
        }
    }

    private getExtensionFromContent(base64Content: string): string {
        const lengthToCheck = Math.min(base64Content.length, 2048) & ~3; // atob needs the length to be a multiple of 4
        const contentStart = atob(base64Content.substring(0, lengthToCheck));
        if (contentStart.startsWith("PK")) {
            return ".kmz";
        }
        if (contentStart.startsWith("\xFF\xD8\xFF")) {
            return ".jpg";
        }
        if (contentStart.indexOf("<kml") !== -1) {
            return ".kml";
        }
        if (contentStart.indexOf("<gpx") !== -1) {
            return ".gpx";
        }
        return ".unknown";
    }

    private getTypeFromUrl(url: string): string {
        const fileName = url.split("/").pop();
        if (!fileName || !fileName.includes(".")) {
            return "application/octet-stream";
        }
        const fileExtension = fileName.split(".").pop().toLocaleLowerCase();
        if (fileExtension === "gpx") {
            return "application/gpx+xml";
        }
        if (fileExtension === "kml") {
            return "application/kml+xml";
        }
        if (fileExtension === "jpg" || fileExtension === "jpeg") {
            return ImageResizeService.JPEG;
        }
        return "application/" + fileExtension;
    }

    public async addRoutesFromFile(file: File): Promise<void> {
        let dataContainer: DataContainer;
        if (file.type === ImageResizeService.JPEG) {
            dataContainer = await this.imageResizeService.resizeImageAndConvert(file);
        } else {
            const fileConent = await file.text();
            this.loggingService.info(`[Files] Finished reading file: ${file.name}, fileConent: ${fileConent}`);
            if (this.gpxDataContainerConverterService.canConvert(fileConent)) {
                dataContainer = await this.gpxDataContainerConverterService.toDataContainer(fileConent);
            } else {
                const formData = new FormData();
                formData.append("file", file, file.name);
                this.loggingService.info(`[Files] The file is not a GPX file, sending it to server for conversion: ${file.name}`);
                dataContainer = await firstValueFrom(this.httpClient.post<DataContainer>(Urls.openFile, formData));
            }
        }
        if (dataContainer.routes.length === 0 ||
            (dataContainer.routes[0].markers.length === 0 && dataContainer.routes[0].segments.length === 0)) {
            throw new Error("no geographic information found in file...");
        }
        await this.addElevationToDataContainer(dataContainer);
        this.addRoutesFromContainer(dataContainer);
    }

    private async addElevationToDataContainer(dataContainer: DataContainer): Promise<void> {
        const promises = [];
        for (const route of dataContainer.routes || []) {
            for (const segment of route.segments || []) {
                promises.push(this.elevationProvider.updateHeights(segment.latlngs));
            }
        }
        await Promise.all(promises);
    }

    public async openFromUrl(url: string): Promise<DataContainer> {
        const container = await firstValueFrom(this.httpClient.get<DataContainer>(Urls.files + "?url=" + url));
        await this.addElevationToDataContainer(container);
        return container;
    }

    public async addRoutesFromUrl(url: string) {
        const container = await this.openFromUrl(url);
        await this.addElevationToDataContainer(container);
        this.addRoutesFromContainer(container);
    }

    private addRoutesFromContainer(container: DataContainer) {
        this.selectedRouteService.addRoutes(container.routes);
        this.mapService.fitBounds(SpatialHelper.getBounds([container.southWest, container.northEast]));
    }

    public async writeStyle(styleFileName: string, styleText: string) {
        await Filesystem.writeFile({
            path: styleFileName,
            data: styleText,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });
        this.loggingService.info(`[Files] Write style finished successfully: ${styleFileName}`);
    }

    public async storeFileToCache(fileName: string, content: string, isBase64: boolean): Promise<string> {
        const results = await Filesystem.writeFile({
            path: fileName,
            data: content,
            directory: Directory.Cache,
            encoding: isBase64 ? undefined : Encoding.UTF8
        });
        return results.uri;
    }

    /**
     * Downloads the offline files into the offline files cache as one batch of the downloader plugin, which keeps going while
     * the app is in the background - from a foreground service that shows the notification on android, and from a continued
     * processing task on iOS 26. A file only takes its name once it is whole, so the cache never holds a part of a file.
     * Resolves once all of them are whole, rejects once one of them failed, and resolves straight away on an abort.
     * The notifications are titled with the name of the area, and the one left behind once the download is done or has
     * failed starts with it, so that a download that ended in the background is not missed.
     */
    public async downloadFilesToCacheAuthenticated(files: OfflineFileToDownload[], token: string, areaName: string,
        progressCallback: FileDownloadProgressCallback, abortController: AbortController): Promise<void> {
        await this.ensureOfflineCacheDirectory();
        const id = `offline-files-${FileService.batchCounter++}`;
        this.loggingService.info(`[Files] Starting downloading ${files.length} files to cache, ${id}: ${files.map(f => f.fileName).join(", ")}`);
        const destinations = await Promise.all(files.map(f => Filesystem.getUri({ path: FileService.offlineCachePath(f.fileName), directory: Directory.Cache })));
        let settle: { resolve: () => void, reject: (error: Error) => void };
        const finished = new Promise<void>((resolve, reject) => settle = { resolve, reject });
        const listeners = await Promise.all([
            CapacitorDownloader.addListener("downloadProgress", event => {
                if (event.id === id && event.fileIndex != null) {
                    progressCallback(event.fileIndex, event.fileProgress ?? 0);
                }
            }),
            CapacitorDownloader.addListener("downloadCompleted", event => {
                if (event.id === id) {
                    settle.resolve();
                }
            }),
            CapacitorDownloader.addListener("downloadFailed", event => {
                if (event.id === id) {
                    settle.reject(new Error(`Failed to download ${files[event.fileIndex]?.fileName ?? "a file"} of ${id}: ${event.error}`));
                }
            })
        ]);
        const abort = () => {
            this.loggingService.info(`[Files] Aborting the download of ${id}`);
            CapacitorDownloader.stop({ id }).catch(() => { });
            settle.resolve();
        };
        abortController.signal.addEventListener("abort", abort, { once: true });
        try {
            await CapacitorDownloader.download({
                id,
                files: files.map((file, index) => ({ url: file.url, destination: destinations[index].uri })),
                headers: { Authorization: `Bearer ${token}` },
                lengthHeader: "X-Uncompressed-Length",
                retries: 3,
                androidHttpEngine: "okhttp",
                notification: "progress",
                title: areaName,
                description: this.resources.downloadMapForOfflineViewing,
                downloadCompletedNotificationText: `${areaName}: ${this.resources.downloadFinishedSuccessfully}`,
                downloadFailedNotificationText: `${areaName}: ${this.resources.downloadFailedOpenTheAppToTryAgain}`,
                iosContinuedProcessing: true
            });
            await finished;
            if (!abortController.signal.aborted) {
                this.loggingService.info(`[Files] Finished downloading ${files.length} files to cache, ${id}`);
            }
        } catch (ex) {
            this.loggingService.error(`[Files] ${(ex as Error).message}`);
            throw ex;
        } finally {
            abortController.signal.removeEventListener("abort", abort);
            await Promise.all(listeners.map(listener => listener.remove()));
        }
    }

    public async readFileInDataDirectory(fileName: string): Promise<string> {
        const file = await Filesystem.readFile({
            path: fileName,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });
        return file.data as string;
    }

    public async moveFileFromCacheToDataDirectory(fileName: string): Promise<void> {
        await Filesystem.rename({
            from: FileService.offlineCachePath(fileName),
            to: fileName,
            directory: Directory.Cache,
            toDirectory: Directory.Data
        })
    }

    /**
     * The offline files that were fully downloaded and are waiting to be moved to the data directory.
     * They are only there while a download is going on, or after one that did not get to finish.
     */
    public async listFilesInOfflineCache(): Promise<string[]> {
        try {
            const results = await Filesystem.readdir({
                path: FileService.OFFLINE_CACHE_DIRECTORY,
                directory: Directory.Cache
            });
            return results.files.filter(f => f.type === "file").map(f => f.name);
        } catch {
            return []; // The directory is only there once something was downloaded into it
        }
    }

    /**
     * Removes whatever is left in the offline files cache, so that a download never continues from files
     * that were downloaded in a previous run of the app and might not be the current ones anymore.
     */
    public async clearOfflineCache(): Promise<void> {
        try {
            await Filesystem.rmdir({
                path: FileService.OFFLINE_CACHE_DIRECTORY,
                directory: Directory.Cache,
                recursive: true
            });
            this.loggingService.info("[Files] Cleared the offline files cache");
        } catch {
            // The directory is only there once something was downloaded into it
        }
    }

    /**
     * Creates the offline files cache directory when it is not there, so that the files are downloaded into a directory
     * that exists. It is only created once it was found to be missing, since creating a directory that is already there
     * is an error on android while it is not on ios.
     */
    private async ensureOfflineCacheDirectory(): Promise<void> {
        if (await this.offlineCacheDirectoryExists()) {
            return;
        }
        try {
            await Filesystem.mkdir({
                path: FileService.OFFLINE_CACHE_DIRECTORY,
                directory: Directory.Cache,
                recursive: true
            });
        } catch (ex) {
            if (await this.offlineCacheDirectoryExists()) {
                return;
            }
            const message = "There is no offline files cache directory to download into and it " +
                `could not be created: ${(ex as Error).message}`;
            this.loggingService.error(`[Files] ${message}`);
            throw new Error(message, { cause: ex });
        }
    }

    private async offlineCacheDirectoryExists(): Promise<boolean> {
        try {
            const result = await Filesystem.stat({
                path: FileService.OFFLINE_CACHE_DIRECTORY,
                directory: Directory.Cache
            });
            return result.type === "directory";
        } catch {
            return false;
        }
    }

    private static offlineCachePath(fileName: string): string {
        return `${FileService.OFFLINE_CACHE_DIRECTORY}/${fileName}`;
    }

    /** 
     * The offline map files an offline download left in the data directory, the only files there anyone asks about.
     */
    public async listOfflineFilesInDataDirectory(): Promise<DataDirectoryFile[]> {
        const results = await Filesystem.readdir({
            path: "",
            directory: Directory.Data
        });
        return results.files
            .filter(f => f.type === "file" && f.name.endsWith(FileService.OFFLINE_FILE_EXTENSION))
            .map(f => ({ fileName: f.name, modifiedDate: new Date(f.mtime), size: f.size }));
    }

    /** The names of the files in the data directory that end with the given suffix, like ".area.json" */
    public async listFileNamesInDataDirectory(suffix: string): Promise<string[]> {
        const results = await Filesystem.readdir({
            path: "",
            directory: Directory.Data
        });
        return results.files.filter(f => f.type === "file" && f.name.endsWith(suffix)).map(f => f.name);
    }

    public async writeFileInDataDirectory(fileName: string, content: string): Promise<void> {
        await Filesystem.writeFile({
            path: fileName,
            data: content,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });
    }

    public async renameFileInDataDirectory(fileName: string, newFileName: string): Promise<void> {
        await Filesystem.rename({
            from: fileName,
            to: newFileName,
            directory: Directory.Data
        });
    }

    public async deleteFileInDataDirectory(fileName: string): Promise<void> {
        try {
            await Filesystem.deleteFile({
                path: fileName,
                directory: Directory.Data
            });
            this.loggingService.info(`[Files] Deleted file: ${fileName}`);
        } catch (ex) {
            this.loggingService.error(`[Files] Failed to delete file: ${fileName}, ${(ex as Error).message}`);
        }
    }
}
