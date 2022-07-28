import { Injectable } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { StyleSpecification } from "maplibre-gl";
import { FileTransfer } from "@ionic-native/file-transfer/ngx";
import { SocialSharing } from "@ionic-native/social-sharing/ngx";
import { last } from "lodash-es";
import { firstValueFrom } from "rxjs";
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import JSZip from "jszip";

import { ImageResizeService } from "./image-resize.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { Urls } from "../urls";
import type { DataContainer } from "../models/models";

export type FormatViewModel = {
    label: string;
    outputFormat: string;
    extension: string;
};

@Injectable()
export class FileService {
    public formats: FormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
                // eslint-disable-next-line
                private readonly fileTransfer: FileTransfer,
                private readonly runningContextService: RunningContextService,
                private readonly imageResizeService: ImageResizeService,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly gpxDataContainerConverterService: GpxDataContainerConverterService,
                private readonly socialSharing: SocialSharing,
                private readonly loggingService: LoggingService) {
        this.formats = [
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
    }

    public getFileFromEvent(e: any): File {
        let file = e.dataTransfer ? e.dataTransfer.files[0] : e.target.files[0];
        if (!file) {
            return null;
        }
        let target = e.target || e.srcElement;
        target.value = "";
        return file;
    }

    public getFilesFromEvent(e: any): File[] {
        let files: FileList = e.dataTransfer ? e.dataTransfer.files : e.target.files;
        if (!files || files.length === 0) {
            return [];
        }
        let filesToReturn = [];
        // eslint-disable-next-line @typescript-eslint/prefer-for-of
        for (let i = 0; i < files.length; i++) {
            filesToReturn.push(files[i]);
        }
        let target = e.target || e.srcElement;
        target.value = ""; // this will reset files so we need to clone the array.
        return filesToReturn;
    }

    public getFullFilePath(relativePath: string): string {
        // HM TODO: make sure iOS works with this as well...
        return (window.origin || window.location.origin) + "/" + relativePath;
    }

    public getStyleFilePath(relativePath: string): string {
        // HM TODO: remove this if this is no longer needed
        return this.getFullFilePath(relativePath);
    }

    public async getStyleJsonContent(url: string, isOffline: boolean): Promise<StyleSpecification> {
        try {
            if (isOffline) {
                let styleFileName = last(url.split("/"));
                let styleText = await Filesystem.readFile({
                    path: styleFileName,
                    directory: Directory.Data,
                    encoding: Encoding.UTF8
                });
                return JSON.parse(styleText.data) as StyleSpecification;
            }
            return await firstValueFrom(this.httpClient.get(url)) as StyleSpecification;
        } catch (ex) {
            this.loggingService.error(`[Files] Unanle to get style file, isOffline: ${isOffline}, ${(ex as Error).message}`);
            return {
                version: 8.0,
                layers: [],
                sources: {}
            };
        }
    }

    private async base64StringToBlob(base64: string, type: string = "application/octet-stream"): Promise<Blob> {
        let response = await fetch(`data:${type};base64,${base64}`);
        return response.blob();
    }

    public async saveToFile(fileName: string, format: string, dataContainer: DataContainer) {
        let responseData = format === "gpx"
            ? await this.gpxDataContainerConverterService.toGpx(dataContainer)
            : await firstValueFrom(this.httpClient.post(Urls.files + "?format=" + format, dataContainer)) as string;

        if (!this.runningContextService.isCapacitor) {
            let blobToSave = await this.base64StringToBlob(responseData);
            this.nonAngularObjectsFactory.saveAsWrapper(blobToSave, fileName, { autoBom: false });
            return;
        }
        fileName = fileName.replace(/[/\\?%*:|"<>]/g, "-");
        let contentType = format === "gpx" ? "application/gpx+xml" : "application/octet-stream";
        this.socialSharing.shareWithOptions({
            files: [`df:${fileName};data:${contentType};base64,${responseData}`]
        });
    }

    public async saveToZipFile(fileName: string, content: string) {
        let zip = new JSZip();
        zip.file("log.txt", content);
        let blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        this.nonAngularObjectsFactory.saveAsWrapper(blob, fileName, { autoBom: false });
    }

    public async getFileFromUrl(url: string, type?: string): Promise<File> {
        let contents = await Filesystem.readFile({
            path: url,
        });
        type = type || this.getTypeFromUrl(url);
        let blob = await this.base64StringToBlob(contents.data, type) as any;
        // HM TODO: get original file name - https://github.com/ionic-team/capacitor/issues/1235
        blob.name = decodeURI(url.split("/").pop());
        if (blob.name.indexOf(".") === -1) {
            blob.name += this.getExtensionFromType(type);
        
        }
        return blob;
    }

    private getTypeFromUrl(url: string): string {
        let fileExtension = url.split("/").pop().split(".").pop().toLocaleLowerCase();
        if (fileExtension === "gpx") {
            return "application/gpx+xml";
        }
        if (fileExtension === "kml") {
            return "application/kml+xml";
        }
        if (fileExtension === "jpg" || fileExtension === "jpeg") {
            return ImageResizeService.JPEG;
        }
        return "appliction/" + fileExtension;
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
            let fileConent = await this.getFileContent(file);
            if (this.gpxDataContainerConverterService.canConvert(fileConent)) {
                dataContainer = await this.gpxDataContainerConverterService.toDataContainer(fileConent);
            } else {
                let formData = new FormData();
                formData.append("file", file, file.name);
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
        let container = await this.openFromUrl(url);
        this.addRoutesFromContainer(container);
    }

    private addRoutesFromContainer(container: DataContainer) {
        this.selectedRouteService.addRoutes(container.routes);
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
    }

    public async writeStyles(blob: Blob) {
        let zip = new JSZip();
        await zip.loadAsync(blob);
        let styles = Object.keys(zip.files).filter(name => name.startsWith("styles/") && name.endsWith(".json"));
        for (let styleFileName of styles) {
            let styleText = (await zip.file(styleFileName).async("text")).trim();
            await Filesystem.writeFile({
                data: styleText,
                path: styleFileName.replace("styles/", ""),
                directory: Directory.Data
            });
            this.loggingService.info(`[Files] Write style finished succefully: ${styleFileName}`);
        }
    }

    public async compressTextToBase64Zip(content: string): Promise<string> {
        let zip = new JSZip();
        zip.file("log.txt", content);
        let data = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
        return data;
    }

    private getDatabaseFolder() {
        return this.runningContextService.isIos
            ? Directory.Documents
            : Directory.Library + "/databases";
    }

    public async saveToDatabasesFolder(blob: Blob, fileName: string) {
        // HM TODO: fix or remove this...
    }

    public async getCachedFile(fileName: string): Promise<string> {
        try {
            let file = await Filesystem.readFile({
                path: fileName,
                directory: Directory.Cache,
                encoding: Encoding.UTF8
            });
            return file.data;
        } catch (ex) {
            this.loggingService.warning("[Files] Unable to get file from cache: " + (ex as Error).message);
            return null;
        }
    }

    private getFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            // HM TODO: maybe the following fix is needed: https://github.com/ionic-team/capacitor/issues/1564
            reader.onload = (event: any) => {
                resolve(event.target.result);
            };
            reader.readAsText(file);
        });
    }

    public storeFileToCache(fileName: string, content: string) {
        return Filesystem.writeFile({
            data: content,
            path: fileName,
            directory: Directory.Cache
        });
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

    public async downloadFileToCache(url: string, progressCallback: (value: number) => void) {
        let fileTransferObject = this.fileTransfer.create();
        let path = await Filesystem.getUri({
            directory: Directory.Cache,
            path: url.split("/").pop()
        })
        fileTransferObject.onProgress((event) => {
            progressCallback(event.loaded / event.total);
        });
        await fileTransferObject.download(url, path.uri, true);
        return path;
    }

    public async getFileFromCache(url: string): Promise<Blob> {
        try {
            let file = await Filesystem.readFile({
                path: url.split("/").pop(),
                directory: Directory.Cache,
            });
            return this.base64StringToBlob(file.data);
        } catch {
            return null;
        }
    }

    public async deleteFileFromCache(url: string): Promise<void> {
        return Filesystem.deleteFile({
            path: url.split("/").pop(),
            directory: Directory.Cache
        });
    }

    public async downloadDatabaseFile(url: string, tempFileName: string, token: string, progressCallback: (value: number) => void) {
        let fileTransferObject = this.fileTransfer.create();
        fileTransferObject.onProgress((event) => {
            progressCallback(event.loaded / event.total);
        });
        this.loggingService.info(`[Files] Starting downloading and writing database file to temporary file name ${tempFileName}`);
        let path = await Filesystem.getUri({
            path: tempFileName,
            directory: Directory.Cache
        });
        await fileTransferObject.download(url, path.uri, true, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        this.loggingService.info(`[Files] Finished downloading and writing database file to temporary file name ${tempFileName}`);
    }

    public async replaceTempDatabaseFile(fileName: string, tempFileName: string) {
        this.loggingService.info(`[Files] Starting moving file ${tempFileName} to ${fileName}`);
        // HM TODO: make sure this works...
        if (this.runningContextService.isIos) {
            await Filesystem.rename({
                from: tempFileName,
                to: fileName,
                directory: Directory.Cache,
                toDirectory: Directory.Documents
            });    
        } else {
            await Filesystem.rename({
                from: tempFileName,
                to: "databases/" + fileName,
                directory: Directory.Cache,
                toDirectory: Directory.Library
            });
        }
        this.loggingService.info(`[Files] Finished moving file ${tempFileName} to ${fileName}`);
    }
}
