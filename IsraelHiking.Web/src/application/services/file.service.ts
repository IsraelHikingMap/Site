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

@Service()
export class FileService {

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

    public async downloadFileToCacheAuthenticated(url: string, fileName: string, token: string, progressCallback: (value: number) => void, abortController: AbortController): Promise<void> {
        this.loggingService.info(`[Files] Starting downloading and writing file to cache, file name ${fileName}`);
        let previousPercentage = 0;
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
        let receivedLength = 0;
        let done: boolean;
        do {
            const readResult = await reader.read();
            done = readResult.done;
            if (done) {
                break;
            }
            const value = readResult.value;
            if (abortController.signal.aborted) {
                this.loggingService.info(`[Files] Aborting download of file ${fileName}`);
                return;
            }

            if (receivedLength === 0) {
                await Filesystem.writeFile({
                    path: fileName,
                    directory: Directory.Cache,
                    data: encode(value.buffer)
                });
            } else {
                await Filesystem.appendFile({
                    path: fileName,
                    directory: Directory.Cache,
                    data: encode(value.buffer)
                });
            }
            receivedLength += value.length;
            if (contentLength > 0) {
                const currentPercentage = receivedLength / contentLength;
                if (currentPercentage - previousPercentage > 0.001) {
                    progressCallback(currentPercentage);
                    previousPercentage = currentPercentage;
                }
            }
        } while (!done);
        this.loggingService.info(`[Files] Finished downloading and writing file to cache, file name ${fileName}`);
    }

    public async moveFileFromCacheToDataDirectory(fileName: string): Promise<void> {
        await Filesystem.rename({
            from: fileName,
            to: fileName,
            directory: Directory.Cache,
            toDirectory: Directory.Data
        })
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
