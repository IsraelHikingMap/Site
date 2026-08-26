import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { last } from "lodash-es";
import { firstValueFrom, timeout } from "rxjs";
import { zipSync, strToU8 } from "fflate";
import { encode } from "base64-arraybuffer";

import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { MapService } from "./map.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { DataContainer } from "../models";

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
};

/**
 * The bytes a download gathered and did not write to its file yet, see DOWNLOAD_WRITE_BUFFER_SIZE.
 * Whether anything was written already tells the write that creates the file from the ones that add to it.
 */
type PendingChunks = {
    chunks: Uint8Array[];
    length: number;
    wroteAnything: boolean;
};

/**
 * Reports how far the download of a file got, in bytes, along with how large the whole file is - which is
 * 0 for as long as the server did not say.
 * It is called with the size and nothing downloaded before the first byte arrives, since the download of a
 * tile can only weigh its files against each other once it knows how large they are, and it is called with
 * the size that was actually read once the file is whole, whatever the server said that size would be.
 */
export type FileDownloadProgressCallback = (receivedBytes: number, totalBytes: number) => void;

/** An offline file that was fully downloaded into the cache and its size in bytes */
export type CachedFile = {
    fileName: string;
    size: number;
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

    /**
     * Tells the file a download is writing apart from the one another download of the same file writes,
     * so that two downloads of the same tile never write over each other, see
     * downloadFileToCacheAuthenticated.
     */
    private static partialFileCounter = 0;

    /**
     * How many bytes a download gathers before it writes them to the file. Every write crosses the bridge
     * as base64 text, which costs far more than the write itself, so the chunks the network hands over -
     * tens of kilobytes each - are gathered into one write instead of being written one by one.
     * Most of what a larger buffer saves is saved by the first megabyte, while the memory it takes is paid
     * by every download that is going on at the same time, along with the base64 text of its own buffer.
     */
    private static readonly DOWNLOAD_WRITE_BUFFER_SIZE = 2 * 1024 * 1024;

    /**
     * How many bytes a download takes in before it reports how far it got again. Every report redraws the
     * tile that is being downloaded on the map, which is worth doing a few times a second and not more.
     */
    private static readonly PROGRESS_REPORT_BYTES = 512 * 1024;

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly mapService = inject(MapService);
    private readonly gpxDataContainerConverterService = inject(GpxDataContainerConverterService);
    private readonly loggingService = inject(LoggingService);
    private readonly elevationProvider = inject(ElevationProvider);

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

    public async getStyleJsonContent(url: string, tryLocalStyle: boolean): Promise<string> {
        try {
            if (this.runningContextService.isCapacitor && url.startsWith(".")) {
                return await this.getLocalStyleJson(url);
            }
            if (tryLocalStyle) {
                return await this.getLocalStyleJson(url);
            }
            return await firstValueFrom(this.httpClient.get(url, { responseType: "text" }).pipe(timeout(5000)));
        } catch (ex) {
            this.loggingService.error(`[Files] Unable to get style file, tryLocalStyle: ${tryLocalStyle}, ${url}, ${(ex as Error).message}`);
            return JSON.stringify({
                version: 8,
                layers: [],
                sources: {}
            });
        }
    }

    private async getLocalStyleJson(url: string): Promise<string> {
        const styleFileName = last(url.split("/"));
        const file = await Filesystem.readFile({
            path: styleFileName,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });
        return file.data as string;
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
        this.mapService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
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
     * Downloads an offline file into the offline files cache. It is written under a name of its own and
     * only takes the name of the file once it was downloaded to its end, so that only whole files are ever
     * in the cache, and so that a download that is still unwinding after it was aborted can not write over
     * the file of the download that took its place - they never share a path.
     * A file that was not downloaded to its end, because the download was aborted or failed, is deleted.
     * The bytes are gathered into large writes rather than written as they arrive, see
     * DOWNLOAD_WRITE_BUFFER_SIZE, and how far the download got is reported in bytes, see
     * FileDownloadProgressCallback.
     */
    public async downloadFileToCacheAuthenticated(url: string, fileName: string, token: string, progressCallback: FileDownloadProgressCallback, abortController: AbortController): Promise<void> {
        this.loggingService.info(`[Files] Starting downloading and writing file to cache, file name ${fileName}`);
        await this.ensureOfflineCacheDirectory();
        const partialFileName = `${fileName}.${FileService.partialFileCounter++}.part`;
        const path = FileService.offlineCachePath(partialFileName);
        let reportedLength = 0;
        const response = await fetch(url, {
            headers: {
                Authorization: `Bearer ${token}`
            },
            signal: abortController.signal
        });
        if (!response.ok) {
            this.loggingService.error(`[Files] Failed to download file: ${fileName}, status: ${response.statusText}`);
            throw new Error(`Failed to download file: ${fileName}, status: ${response.statusText}`);
        }
        const reader = response.body.getReader();
        const contentLength = Number(response.headers.get("Content-Length"));
        progressCallback(0, contentLength);
        let receivedLength = 0;
        const pending: PendingChunks = { chunks: [], length: 0, wroteAnything: false };
        let done: boolean;
        try {
            do {
                const readResult = await reader.read();
                done = readResult.done;
                if (done) {
                    break;
                }
                const value = readResult.value;
                if (abortController.signal.aborted) {
                    this.loggingService.info(`[Files] Aborting download of file ${fileName}`);
                    await this.deleteFileInOfflineCache(partialFileName);
                    return;
                }

                pending.chunks.push(value);
                pending.length += value.length;
                receivedLength += value.length;
                if (pending.length >= FileService.DOWNLOAD_WRITE_BUFFER_SIZE) {
                    await this.writePendingChunks(path, pending);
                }
                if (receivedLength - reportedLength >= FileService.PROGRESS_REPORT_BYTES) {
                    progressCallback(receivedLength, contentLength);
                    reportedLength = receivedLength;
                }
            } while (!done);
            await this.writePendingChunks(path, pending);
        } catch (ex) {
            await this.deleteFileInOfflineCache(partialFileName);
            throw ex;
        }
        progressCallback(receivedLength, receivedLength);
        await Filesystem.rename({
            from: path,
            to: FileService.offlineCachePath(fileName),
            directory: Directory.Cache
        });
        this.loggingService.info(`[Files] Finished downloading and writing file to cache, file name ${fileName}, ` +
            `${(receivedLength / 1024 / 1024).toFixed(1)} MB`);
    }

    /**
     * Writes the bytes a download gathered so far into its file and empties them, so that the ones that
     * come next are gathered on their own. The first write creates the file and the rest add to it, which
     * also means that a file that holds no bytes at all is still created.
     */
    private async writePendingChunks(path: string, pending: PendingChunks): Promise<void> {
        if (pending.length === 0 && pending.wroteAnything) {
            return;
        }
        const data = encode(FileService.concatenateChunks(pending.chunks, pending.length));
        pending.chunks = [];
        pending.length = 0;
        if (pending.wroteAnything) {
            await Filesystem.appendFile({
                path,
                directory: Directory.Cache,
                data
            });
            return;
        }
        await Filesystem.writeFile({
            path,
            directory: Directory.Cache,
            data
        });
        pending.wroteAnything = true;
    }

    /**
     * Gathers the chunks the network handed over into one buffer of exactly their bytes, since a chunk
     * might be a view into a larger buffer, which holds bytes that are not a part of it.
     */
    private static concatenateChunks(chunks: Uint8Array[], totalLength: number): ArrayBuffer {
        const buffer = new Uint8Array(totalLength);
        let offset = 0;
        for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
        }
        return buffer.buffer;
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
    public async listFilesInOfflineCache(): Promise<CachedFile[]> {
        try {
            const results = await Filesystem.readdir({
                path: FileService.OFFLINE_CACHE_DIRECTORY,
                directory: Directory.Cache
            });
            return results.files.filter(f => f.type === "file").map(f => ({ fileName: f.name, size: f.size }));
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
     * Creates the offline files cache directory when it is not there. Neither writing the first chunk of a
     * file nor appending the rest of them creates it, so it is created before the file is downloaded.
     * It is only created once it was found to be missing, since creating a directory that is already there
     * is an error on android while it is not on ios. Creating it can still fail on another download that
     * is creating it at that same moment, files are downloaded a few at a time, which is not a problem as
     * long as it ended up there - what the failure was is only worth passing on when it did not.
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

    private async deleteFileInOfflineCache(fileName: string): Promise<void> {
        try {
            await Filesystem.deleteFile({
                path: FileService.offlineCachePath(fileName),
                directory: Directory.Cache
            });
        } catch (ex) {
            this.loggingService.debug(`[Files] Did not delete the partial file: ${fileName}, ${(ex as Error).message}`);
        }
    }

    private static offlineCachePath(fileName: string): string {
        return `${FileService.OFFLINE_CACHE_DIRECTORY}/${fileName}`;
    }

    /**
     * The files that are currently stored in the data directory, which is where the offline files are
     * kept, with the time each of them was last written to. Directories are not returned, only files.
     */
    public async listFilesInDataDirectory(): Promise<DataDirectoryFile[]> {
        const results = await Filesystem.readdir({
            path: "",
            directory: Directory.Data
        });
        return results.files.filter(f => f.type === "file").map(f => ({ fileName: f.name, modifiedDate: new Date(f.mtime), size: f.size }));
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
