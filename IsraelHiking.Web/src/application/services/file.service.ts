import { Inject, Injectable, InjectionToken } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { StyleSpecification } from "maplibre-gl";
import { File as FileSystemWrapper, FileEntry } from "@awesome-cordova-plugins/file/ngx";
import { FileTransfer } from "@awesome-cordova-plugins/file-transfer/ngx";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { last } from "lodash-es";
import { firstValueFrom } from "rxjs";
import type { saveAs as saveAsForType } from "file-saver";
import JSZip from "jszip";

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
    public formats: FormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
                private readonly fileSystemWrapper: FileSystemWrapper,
                // eslint-disable-next-line
                private readonly fileTransfer: FileTransfer,
                private readonly runningContextService: RunningContextService,
                private readonly imageResizeService: ImageResizeService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly fitBoundsService: FitBoundsService,
                private readonly gpxDataContainerConverterService: GpxDataContainerConverterService,
                private readonly socialSharing: SocialSharing,
                private readonly loggingService: LoggingService,
                @Inject(SaveAsFactory) private readonly saveAs: typeof saveAsForType) {
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
            this.loggingService.error(`[Files] Unanle to get style file, isOffline: ${isOffline}, ${(ex as Error).message}`);
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
        const contentType = format === "gpx" ? "application/gpx+xml" : "application/octet-stream";
        this.socialSharing.shareWithOptions({
            files: [`df:${fileName};data:${contentType};base64,${responseData}`]
        });
    }

    public async saveToZipFile(fileName: string, content: string) {
        const zip = new JSZip();
        zip.file("log.txt", content);
        const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE", compressionOptions: { level: 6 } });
        this.saveAs(blob, fileName, { autoBom: false });
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
            const fileConent = await this.getFileContent(file);
            if (this.gpxDataContainerConverterService.canConvert(fileConent)) {
                dataContainer = await this.gpxDataContainerConverterService.toDataContainer(fileConent);
            } else {
                const formData = new FormData();
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
        const container = await this.openFromUrl(url);
        this.addRoutesFromContainer(container);
    }

    private addRoutesFromContainer(container: DataContainer) {
        this.selectedRouteService.addRoutes(container.routes);
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.southWest, container.northEast]));
    }

    public async writeStyles(blob: Blob) {
        const zip = new JSZip();
        await zip.loadAsync(blob);
        const styles = Object.keys(zip.files).filter(name => name.startsWith("styles/") && name.endsWith(".json"));
        for (const styleFileName of styles) {
            const styleText = (await zip.file(styleFileName).async("text")).trim();
            await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.dataDirectory, styleFileName.replace("styles/", ""), styleText,
                { append: false, replace: true, truncate: 0 });
            this.loggingService.info(`[Files] Write style finished succefully: ${styleFileName}`);
        }
    }

    public async compressTextToBase64Zip(contents: {name: string; text: string}[]): Promise<string> {
        const zip = new JSZip();
        for (const content of contents) {
            zip.file(content.name, content.text);
        }
        const data = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
        return data;
    }

    public async getCachedFile(fileName: string): Promise<string> {
        try {
            return await this.fileSystemWrapper.readAsText(this.fileSystemWrapper.cacheDirectory, fileName);
        } catch (ex) {
            this.loggingService.warning("[Files] Unable to get file from cache: " + (ex as Error).message);
            return null;
        }
    }

    private getFileContent(file: File): Promise<string> {
        return new Promise((resolve, _) => {
            const reader = new FileReader();
            reader.onload = (event: any) => {
                resolve(event.target.result);
            };
            reader.readAsText(file);
        });
    }

    public storeFileToCache(fileName: string, content: string | Blob) {
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

    public async downloadFileToCache(url: string, progressCallback: (value: number) => void) {
        const fileTransferObject = this.fileTransfer.create();
        const path = this.fileSystemWrapper.cacheDirectory + url.split("/").pop();
        fileTransferObject.onProgress((event) => {
            progressCallback(event.loaded / event.total);
        });
        await fileTransferObject.download(url, path, true);
        return path;
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
        this.fileSystemWrapper.removeFile(this.fileSystemWrapper.cacheDirectory, url.split("/").pop());
    }

    public async downloadDatabaseFile(url: string, dbFileName: string, token: string, progressCallback: (value: number) => void) {
        const fileTransferObject = this.fileTransfer.create();
        fileTransferObject.onProgress((event) => {
            progressCallback(event.loaded / event.total);
        });
        this.loggingService.info(`[Files] Starting downloading and writing database file to temporary file name ${dbFileName}`);
        await fileTransferObject.download(url, this.fileSystemWrapper.cacheDirectory + dbFileName, true, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
        this.loggingService.info(`[Files] Finished downloading and writing database file to temporary file name ${dbFileName}`);
    }

    public async renameOldDatabases(): Promise<boolean> {
        if (!this.runningContextService.isCapacitor) {
            return false;
        }
        let filesExist = false;
        const filePrefix = this.runningContextService.isIos ? "" : "databases/";
        const originFolder = this.runningContextService.isIos
            ? this.fileSystemWrapper.documentsDirectory
            : this.fileSystemWrapper.applicationStorageDirectory;
        for (const fileName of ["Contour.mbtiles", "IHM.mbtiles", "TerrainRGB.mbtiles"]) {
            const fullFileName = filePrefix + fileName;
            this.loggingService.info(`[Files] Checking if database file exists: ${fullFileName}`);
            try {
                const fileExists = await this.fileSystemWrapper.checkFile(originFolder, fullFileName);
                if (!fileExists) { continue; }
                this.loggingService.info(`[Files] Statring renaming database: ${fullFileName}`);
                await this.fileSystemWrapper.moveFile(originFolder, fullFileName, originFolder, fullFileName.replace(".mbtiles", ".db"));
                this.loggingService.info(`[Files] Finished renaming database: ${fullFileName}`);
                filesExist = true;
            } catch { } // eslint-disable-line
        }
        return filesExist;
    }
}
