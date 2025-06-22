import { inject, Injectable, InjectionToken } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { StyleSpecification } from "maplibre-gl";
import { File as FileSystemWrapper, FileEntry } from "@awesome-cordova-plugins/file/ngx";
import { FileTransfer } from "@awesome-cordova-plugins/file-transfer/ngx";
import { Share } from "@capacitor/share";
import { last } from "lodash-es";
import { firstValueFrom } from "rxjs";
import { zipSync, strToU8, unzipSync, strFromU8, Zippable } from "fflate";
import { decode, encode } from "base64-arraybuffer";
import type { saveAs as saveAsForType } from "file-saver";

import { ImageResizeService } from "./image-resize.service";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { Urls } from "../urls";
import type { DataContainer } from "../models/models";

export const SaveAsFactory = new InjectionToken<typeof saveAsForType>(null);

export type FormatViewModel = {
    label: string;
    outputFormat: string;
    extension: string;
};

@Injectable()
export class FileService {

    private readonly httpClient = inject(HttpClient);
    private readonly fileSystemWrapper = inject(FileSystemWrapper);
    private readonly fileTransfer = inject(FileTransfer);
    private readonly runningContextService = inject(RunningContextService);
    private readonly imageResizeService = inject(ImageResizeService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly gpxDataContainerConverterService = inject(GpxDataContainerConverterService);
    private readonly loggingService = inject(LoggingService);
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

    public async getStyleJsonContent(url: string, isOffline: boolean): Promise<StyleSpecification> {
        try {
            if (isOffline || (this.runningContextService.isCapacitor && url.startsWith("."))) {
                const styleFileName = last(url.split("/"));
                const styleText = await this.fileSystemWrapper.readAsText(this.fileSystemWrapper.dataDirectory, styleFileName);
                return JSON.parse(styleText) as StyleSpecification;
            }
            return await firstValueFrom(this.httpClient.get(url)) as StyleSpecification;
        } catch (ex) {
            this.loggingService.error(`[Files] Unable to get style file, isOffline: ${isOffline}, ${(ex as Error).message}`);
            return {
                version: 8.0,
                layers: [],
                sources: {}
            };
        }
    }

    private async base64StringToBlob(base64: string, type = "application/octet-stream"): Promise<Blob> {
        const response = await fetch(`data:${type};base64,${base64}`);
        return response.blob();
    }

    public async saveToFile(fileName: string, format: string, dataContainer: DataContainer) {
        const responseData = format === "gpx"
            ? await this.gpxDataContainerConverterService.toGpx(dataContainer)
            : await firstValueFrom(this.httpClient.post(Urls.files + "?format=" + format, dataContainer)) as string;

        if (!this.runningContextService.isCapacitor) {
            const blobToSave = await this.base64StringToBlob(responseData);
            this.saveAs(blobToSave, fileName, { autoBom: false });
            return;
        }
        fileName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
        await this.storeFileToCache(fileName, decode(responseData))
        const entry = await this.fileSystemWrapper.resolveLocalFilesystemUrl(this.fileSystemWrapper.cacheDirectory + fileName);
        Share.share({
            files: [entry.nativeURL]
        });
    }

    public async saveLogToZipFile(fileName: string, content: string) {
        const result = zipSync({ "log.txt": strToU8(content) });
        const resultBlob = new Blob([result]);
        this.saveAs(resultBlob, fileName, { autoBom: false });
    }

    public async getFileFromUrl(url: string, type?: string): Promise<File> {
        const entry = await this.fileSystemWrapper.resolveLocalFilesystemUrl(url) as FileEntry;
        const file = await new Promise((resolve, reject) => {
            entry.file((fileContent) => {
                const reader = new FileReader();
                reader.onload = (event: any) => {
                    type = type || this.getTypeFromUrl(url);
                    const blob = new Blob([event.target.result], { type }) as any;
                    blob.name = entry.name;
                    if (blob.name.indexOf(".") === -1) {
                        blob.name += this.getExtensionFromType(type);
                    }
                    resolve(blob);
                };
                reader.onerror = () => {
                    reject(new Error("Unable to read file from url: " + url));
                }
                reader.readAsArrayBuffer(fileContent);
            }, reject);
        }) as File;
        return file;
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
                dataContainer = await firstValueFrom(this.httpClient.post(Urls.openFile, formData)) as DataContainer;
            }
        }
        if (dataContainer.routes.length === 0 ||
            (dataContainer.routes[0].markers.length === 0 && dataContainer.routes[0].segments.length === 0)) {
            throw new Error("no geographic information found in file...");
        }
        this.addRoutesFromContainer(dataContainer);
    }

    public openFromUrl(url: string): Promise<DataContainer> {
        return firstValueFrom(this.httpClient.get(Urls.files + "?url=" + url)) as Promise<DataContainer>;
    }

    public async addRoutesFromUrl(url: string) {
        const container = await this.openFromUrl(url);
        this.addRoutesFromContainer(container);
    }

    private addRoutesFromContainer(container: DataContainer) {
        this.selectedRouteService.addRoutes(container.routes);
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
    }

    public async writeStyles(blob: Blob) {
        const zipData = new Uint8Array(await blob.arrayBuffer());
        const files = unzipSync(zipData, {
            filter: file => file.name.startsWith("styles/") && file.name.endsWith(".json")
        });

        for (const styleFileName in files) {
            const styleText = strFromU8(files[styleFileName]);
            this.writeStyle(styleFileName.replace("styles/", ""), styleText);
        }
    }

    public async writeStyle(styleFileName: string, styleText: string) {
        await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.dataDirectory, styleFileName, styleText,
            { append: false, replace: true, truncate: 0 });
        this.loggingService.info(`[Files] Write style finished successfully: ${styleFileName}`);
    }

    public async compressTextToBase64Zip(contents: {name: string; text: string}[]): Promise<string> {
        const zippable: Zippable = {};
        for (const content of contents) {
            zippable[content.name] = strToU8(content.text);
        }
        const result = zipSync(zippable);
        return encode(await new Response(result).arrayBuffer());
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

    public storeFileToCache(fileName: string, content: string | Blob | ArrayBuffer): Promise<void> {
        return this.fileSystemWrapper.writeFile(this.fileSystemWrapper.cacheDirectory, fileName, content,
            { replace: true, append: false, truncate: 0 });
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
            const fileBuffer = await this.fileSystemWrapper.readAsArrayBuffer(this.fileSystemWrapper.cacheDirectory, url.split("/").pop());
            return new Blob([fileBuffer]);
        } catch {
            return null;
        }
    }

    public async deleteFileFromCache(url: string): Promise<void> {
        await this.fileSystemWrapper.removeFile(this.fileSystemWrapper.cacheDirectory, url.split("/").pop());
    }

    public downloadFileToCache(url: string, progressCallback: (value: number) => void) {
        return this.downloadFileToCacheAuthenticated(url, url.split("/").pop(), null, progressCallback);
    }

    public async downloadFileToCacheAuthenticated(url: string, fileName: string, token: string, progressCallback: (value: number) => void) {
        const fileTransferObject = this.fileTransfer.create();
        fileTransferObject.onProgress((event) => {
            progressCallback(event.loaded / event.total);
        });
        this.loggingService.info(`[Files] Starting downloading and writing file to cache, file name ${fileName}`);
        const options = !token ? undefined : {
            headers: {
                Authorization: `Bearer ${token}`
            }
        };
        await fileTransferObject.download(url, this.fileSystemWrapper.cacheDirectory + fileName, true, options);
        this.loggingService.info(`[Files] Finished downloading and writing file to cache, file name ${fileName}`);
    }

    public async moveFileFromCacheToDataDirectory(fileName: string): Promise<void> {
        await this.fileSystemWrapper.moveFile(this.fileSystemWrapper.cacheDirectory, fileName, this.fileSystemWrapper.dataDirectory, fileName);
    }
}
