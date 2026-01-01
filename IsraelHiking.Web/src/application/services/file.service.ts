import { inject, Injectable, InjectionToken } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { StyleSpecification } from "maplibre-gl";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import { last } from "lodash-es";
import { firstValueFrom, timeout } from "rxjs";
import { zipSync, strToU8 } from "fflate";
import { decode, encode } from "base64-arraybuffer";
import type { saveAs as saveAsForType } from "file-saver";

import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { DataContainer } from "../models";

export const SaveAsFactory = new InjectionToken<typeof saveAsForType>(null);

export type FormatViewModel = {
    label: string;
    outputFormat: string;
    extension: string;
};

@Injectable()
export class FileService {

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly gpxDataContainerConverterService = inject(GpxDataContainerConverterService);
    private readonly loggingService = inject(LoggingService);
    private readonly elevationProvider = inject(ElevationProvider);
    private readonly saveAs = inject(SaveAsFactory);

    public formats: FormatViewModel[] = [
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
            outputFormat: "twl",
        },
        {
            label: "All routes to a single Track GPX (.gpx)",
            extension: "gpx",
            outputFormat: "all_gpx_single_track"
        }
    ];

    public getFileFromEvent(e: any): File {
        const file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return null;
        }
        const target = e.target || e.srcElement;
        target.value = "";
        return file;
    }

    public getFilesFromEvent(e: any): File[] {
        const files: FileList = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        if (!files || files.length === 0) {
            return [];
        }
        const filesToReturn = [];
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < files.length; i++) {
            filesToReturn.push(files[i]);
        }
        const target = e.target || e.srcElement;
        target.value = ""; // this will reset files so we need to clone the array.
        return filesToReturn;
    }

    public getFullUrl(relativePath: string): string {
        return (window.origin || window.location.origin) + "/" + relativePath;
    }

    public async getStyleJsonContent(url: string, tryLocalStyle: boolean): Promise<StyleSpecification> {
        try {
            if (this.runningContextService.isCapacitor && url.startsWith(".")) {
                return await this.getLocalStyleJson(url);
            }
            if (tryLocalStyle) {
                return await this.getLocalStyleJson(url);
            }
            return await firstValueFrom(this.httpClient.get<StyleSpecification>(url).pipe(timeout(5000)));
        } catch (ex) {
            this.loggingService.error(`[Files] Unable to get style file, tryLocalStyle: ${tryLocalStyle}, ${url}, ${(ex as Error).message}`);
            return {
                version: 8.0,
                layers: [],
                sources: {}
            };
        }
    }

    private async getLocalStyleJson(url: string): Promise<StyleSpecification> {
        const styleFileName = last(url.split("/"));
        const file = await Filesystem.readFile({
            path: styleFileName,
            directory: Directory.Data,
            encoding: Encoding.UTF8
        });
        const styleText = file.data as string;
        return JSON.parse(styleText) as StyleSpecification;
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
            this.saveAs(blobToSave, fileName, { autoBom: false });
            return;
        }
        fileName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
        const fileUrl = await this.storeFileToCache(fileName, responseData);
        Share.share({
            files: [fileUrl]
        });
    }

    public async saveLogToZipFile(fileName: string, content: string) {
        const result = zipSync({ "log.txt": strToU8(content) });
        const resultBlob = new Blob([result as Uint8Array<ArrayBuffer>], { type: "application/zip" });
        this.saveAs(resultBlob, fileName, { autoBom: false });
    }

    public async getFileFromUrl(url: string, type?: string): Promise<File> {
        const fileResponse = await Filesystem.readFile({
            path: url,
        });
        const statResponse = await Filesystem.stat({
            path: url,
        });
        type = type || this.getTypeFromUrl(url);
        const blob = new Blob([decode(fileResponse.data as string)], { type }) as any;
        blob.name = statResponse.name;
        if (blob.name.indexOf(".") === -1) {
            blob.name += this.getExtensionFromType(type);
        }
        return blob;
    }

    private getTypeFromUrl(url: string): string {
        const fileExtension = url.split("/").pop().split(".").pop().toLocaleLowerCase();
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

    private getExtensionFromType(type: string): string {
        if (type.indexOf("gpx") !== -1) {
            return ".gpx";
        }
        if (type.indexOf("kml") !== -1) {
            return ".kml";
        }
        if (type.indexOf("jpg") !== -1 || type.indexOf("jpeg") !== -1) {
            return ".jpg";
        }
        return "." + type.split("/").pop();
    }

    public async addRoutesFromFile(file: File): Promise<void> {
        let dataContainer: DataContainer = null;
        if (file.type === ImageResizeService.JPEG) {
            dataContainer = await this.imageResizeService.resizeImageAndConvert(file);
        } else {
            const fileConent = await this.getFileContent(file);
            this.loggingService.info(`[Files] Finished reading file: ${file.name}`);
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
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
    }

    public async writeStyle(styleFileName: string, styleText: string) {
        await Filesystem.writeFile({
            path: styleFileName,
            data: styleText,
            directory: Directory.Data,
        });
        this.loggingService.info(`[Files] Write style finished successfully: ${styleFileName}`);
    }

    public getFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event: any) => {
                resolve(event.target.result);
            };
            reader.onerror = () => {
                reject(new Error("Unable to read the contect of the text file: " + file.name));
            }
            reader.readAsText(file);
        });
    }

    public async storeFileToCache(fileName: string, content: string): Promise<string> {
        await Filesystem.writeFile({
            path: fileName,
            data: content,
            directory: Directory.Cache,
        });
        const entry = await Filesystem.getUri({
            path: fileName,
            directory: Directory.Cache,
        });
        return entry.uri;
    }

    /**
     * Downloads a file while reporting progress
     *
     * @param url The url of the file
     * @param progressCallback reports progress between 0 and 1
     */
    public async getFileContentWithProgress(url: string, progressCallback: (value: number) => void): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this.httpClient.get(url, {
                observe: "events",
                responseType: "blob",
                reportProgress: true
            }).subscribe({
                next: (event) => {
                    if (event.type === HttpEventType.DownloadProgress) {
                        progressCallback(event.loaded / event.total);
                    }
                    if (event.type === HttpEventType.Response) {
                        if (event.ok) {
                            resolve(event.body);
                        } else {
                            reject(new Error(event.statusText));
                        }
                    }
                }, error: (error) => reject(error)
            });
        });
    }


    public async getFileFromCache(url: string): Promise<Blob> {
        try {
            const fileName = url.split("/").pop();
            const fileResponse = await Filesystem.readFile({
                path: fileName,
                directory: Directory.Cache
            });
            const fileBuffer = decode(fileResponse.data as string);
            return new Blob([fileBuffer]);
        } catch {
            return null;
        }
    }

    public downloadFileToCacheAuthenticated(url: string, fileName: string, token: string, progressCallback: (value: number) => void, abortController: AbortController): Promise<void> {
        this.loggingService.info(`[Files] Starting downloading and writing file to cache, file name ${fileName}`);
        let previousPercentage = 0;
        return new Promise<void>((resolve, reject) => {
            fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(async (response) => {
                if (!response.ok) {
                    this.loggingService.error(`[Files] Failed to download file: ${fileName}, status: ${response.statusText}`);
                    reject(new Error(`Failed to download file: ${fileName}, status: ${response.statusText}`));
                    return;
                }
                const reader = response.body.getReader();
                const contentLength = Number(response.headers.get("Content-Length"));
                let receivedLength = 0;
                while (true) {
                    const { done, value } = await reader.read();
                    if (abortController.signal.aborted) {
                        this.loggingService.info(`[Files] Aborting download of file ${fileName}`);
                        resolve();
                        return;
                    }
                    if (done) {
                        this.loggingService.info(`[Files] Finished downloading and writing file to cache, file name ${fileName}`);
                        resolve();
                        break;
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
                }
            });
        });
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
