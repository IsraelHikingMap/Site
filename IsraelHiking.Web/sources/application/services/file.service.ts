import { Injectable } from "@angular/core";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { Style } from "mapbox-gl";
import { File as FileSystemWrapper, FileEntry } from "@ionic-native/file/ngx";
import { WebView } from "@ionic-native/ionic-webview/ngx";
import { FileTransfer } from "@ionic-native/file-transfer/ngx";
import { SocialSharing } from "@ionic-native/social-sharing/ngx";
import { last } from "lodash";
import JSZip from "jszip";

import { ImageResizeService } from "./image-resize.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { Urls } from "../urls";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { DataContainer } from "../models/models";

export interface IFormatViewModel {
    label: string;
    outputFormat: string;
    extension: string;
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
                private readonly fileSystemWrapper: FileSystemWrapper,
                private readonly webView: WebView,
                // tslint:disable-next-line
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
        // tslint:disable-next-line:prefer-for-of
        for (let i = 0; i < files.length; i++) {
            filesToReturn.push(files[i]);
        }
        let target = e.target || e.srcElement;
        target.value = ""; // this will reset files so we need to clone the array.
        return filesToReturn;
    }

    public getFullFilePath(relativePath: string): string {
        if (!this.runningContextService.isCordova) {
            return (window.origin || window.location.origin) + "/" + relativePath;
        }
        let path = relativePath;
        if (this.runningContextService.isIos) {
            path = this.fileSystemWrapper.applicationDirectory + "www/" + relativePath;
            path = this.webView.convertFileSrc(path);
        } else {
            path = "http://localhost/" + relativePath;
        }
        return path;
    }

    public getDataUrl(url: string): string {
        if (!url.startsWith("https://") && this.runningContextService.isCordova) {

            url = this.webView.convertFileSrc(this.fileSystemWrapper.dataDirectory + url.replace("custom://", ""));
        }
        return url;
    }

    public getStyleJsonContent(url: string, isOffline: boolean): Promise<Style> {
        if (isOffline) {
            url = last(url.split("/"));
        }
        return this.httpClient.get(this.getDataUrl(url)).toPromise() as Promise<Style>;
    }

    public async saveToFile(fileName: string, format: string, dataContainer: DataContainer) {
        // HM TODO: do this locally in case of simple GPX
        let responseData = await this.httpClient.post(Urls.files + "?format=" + format, dataContainer).toPromise() as string;
        if (!this.runningContextService.isCordova) {
            let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(responseData, "application/octet-stream");
            this.nonAngularObjectsFactory.saveAsWrapper(blobToSave, fileName, { autoBom: false });
            return;
        }
        let fullFileName = new Date().toISOString().split(":").join("-").replace("T", "_")
            .replace("Z", "_") +
            fileName.replace(/[/\\?%*:|"<>]/g, "-").split(" ").join("_");
        let contentType = format === "gpx" ? "application/gpx+xml" : "application/octet-stream";
        this.socialSharing.shareWithOptions({
            files: [`df:${fileName};data:${contentType};base64,${responseData}`]
        });
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
                dataContainer = await this.httpClient.post(Urls.openFile, formData).toPromise() as DataContainer;
            }
        }
        if (dataContainer.routes.length === 0 ||
            (dataContainer.routes[0].markers.length === 0 && dataContainer.routes[0].segments.length === 0)) {
            throw new Error("no geographic information found in file...");
        }
        this.addRoutesFromContainer(dataContainer);
    }

    public openFromUrl = (url: string): Promise<DataContainer> => {
        return this.httpClient.get(Urls.files + "?url=" + url).toPromise() as Promise<DataContainer>;
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
            await this.fileSystemWrapper.writeFile(this.fileSystemWrapper.dataDirectory, styleFileName.replace("styles/", ""), styleText,
                { append: false, replace: true, truncate: 0 });
            this.loggingService.debug(`Write style finished succefully: ${styleFileName}`);
        }
    }

    public async zipAndStoreFile(content: string): Promise<string> {
        let zip = new JSZip();
        zip.file("log.txt", content);
        let data = await zip.generateAsync({ type: "base64", compression: "DEFLATE", compressionOptions: { level: 6 } });
        return data;
    }

    private getDatabaseFolder() {
        return this.runningContextService.isIos
            ? this.fileSystemWrapper.documentsDirectory
            : this.fileSystemWrapper.applicationStorageDirectory + "/databases";
    }

    public async saveToDatabasesFolder(blob: Blob, fileName: string) {
        let path = this.getDatabaseFolder();
        await this.fileSystemWrapper.writeFile(path, fileName, blob, { append: false, replace: true, truncate: 0 });
    }

    public async getLocalFileUrl(relativePath: string): Promise<string> {
        let fileEntry = await this.fileSystemWrapper
            .resolveLocalFilesystemUrl(this.fileSystemWrapper.applicationDirectory + "www/" + relativePath) as FileEntry;
        return await new Promise((resolve, reject) => {
            fileEntry.file((file) => {
                resolve(file.localURL);
            }, reject);
        });
    }

    public async getCachedFile(fileName: string): Promise<string> {
        try {
            return await this.fileSystemWrapper.readAsText(this.fileSystemWrapper.cacheDirectory, fileName);
        } catch (ex) {
            this.loggingService.warning("Unable to get file from cache: " + ex.message);
            return null;
        }
    }

    private getFileContent(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = (event: any) => {
                resolve(event.target.result);
            };
            reader.readAsText(file);
        });
    }

    public storeFileToCache(fileName: string, content: string) {
        return this.fileSystemWrapper.writeFile(this.fileSystemWrapper.cacheDirectory, fileName, content,
            { replace: true, append: false, truncate: 0 });
    }

    /**
     * Downloads a file while reporting progress
     * @param url The url of the file
     * @param progressCallback reports progress between 0 and 1
     */
    public async getFileContentWithProgress(url: string, progressCallback: (value: number) => void): Promise<Blob> {
        return new Promise((resolve, reject) => {
            this.httpClient.get(url, {
                observe: "events",
                responseType: "blob",
                reportProgress: true
            }).subscribe(event => {
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
            }, error => reject(error));
        });
    }

    public async downloadDatabaseFile(url: string, fileName: string, token: string, progressCallback: (value: number) => void) {
        let fileTransferObject = this.fileTransfer.create();
        let path = this.getDatabaseFolder();
        fileTransferObject.onProgress((event) => {
            progressCallback(event.loaded / event.total);
        });
        await fileTransferObject.download(url, path + "/" + fileName, true, {
            headers: {
                Authorization: `Bearer ${token}`
            }
        });
    }
}
