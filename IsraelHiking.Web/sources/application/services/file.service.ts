/// <reference types="cordova-plugin-device"/>
import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ImageResizeService } from "./image-resize.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { Urls } from "../urls";
import { DataContainer, RouteData } from "../models/models";
import { RunningContextService } from "./running-context.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { FitBoundsService } from "./fit-bounds.service";
import { SpatialService } from "./spatial.service";

declare var cordova: any;

export interface IFormatViewModel {
    label: string;
    outputFormat: string;
    extension: string;
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
        private readonly runningContextService: RunningContextService,
        private readonly imageResizeService: ImageResizeService,
        private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly fitBoundsService: FitBoundsService) {
        this.formats = [];
        this.httpClient.get(Urls.fileFormats).toPromise().then((response: IFormatViewModel[]) => {
            this.formats.splice(0);
            for (let format of response) {
                this.formats.push(format);
            }
            this.formats.push({
                label: "All routes to a single Track GPX",
                extension: "gpx",
                outputFormat: "all_gpx_single_track"
            } as IFormatViewModel);

            for (let format of this.formats) {
                format.label += ` (.${format.extension})`;
            }
        });
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
        for (let i = 0; i < files.length; i++) {
            filesToReturn.push(files[i]);
        }
        let target = e.target || e.srcElement;
        target.value = ""; // this will reset files so we need to clone the array.
        return filesToReturn;
    }

    public saveToFile = async (fileName: string, format: string, dataContainer: DataContainer): Promise<boolean> => {
        let responseData = await this.httpClient.post(Urls.files + "?format=" + format, dataContainer).toPromise() as string;
        return await this.saveBytesResponseToFile(responseData, fileName);
    }

    public async addRoutesFromFile(file: File): Promise<any> {
        if (file.type === ImageResizeService.JPEG) {
            let container = await this.imageResizeService.resizeImageAndConvert(file);
            this.addRoutesFromContainer(container);
            return;
        }
        let formData = new FormData();
        formData.append("file", file, file.name);
        let fileContainer = await this.httpClient.post(Urls.openFile, formData).toPromise() as DataContainer;
        this.addRoutesFromContainer(fileContainer);
    }

    public uploadTrace(file: File): Promise<any> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(Urls.osmTrace, formData, { responseType: "text" }).toPromise();
    }

    public async uploadRouteAsTrace(route: RouteData): Promise<any> {
        let data = {
            routes: [route]
        } as DataContainer;
        let responseData = await this.httpClient.post(Urls.files + "?format=gpx", data).toPromise() as string;
        let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(responseData, "application/octet-stream");
        let formData = new FormData();
        formData.append("file", blobToSave, route.name + ".gpx");
        return this.httpClient.post(Urls.osmTrace, formData, { responseType: "text" }).toPromise();
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
        this.fitBoundsService.fitBounds(SpatialService.getBounds([container.northEast, container.southWest]));
    }

    private saveBytesResponseToFile = async (data: string, fileName: string): Promise<boolean> => {
        let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(data, "application/octet-stream");
        return await this.saveAsWorkAround(blobToSave, fileName);
    }

    /**
     * This is an ugly workaround suggested here:
     * https://github.com/eligrey/FileSaver.js/issues/330
     * Plus cordova file save.
     * Return true if there's a need to show a toast message.
     * @param blob
     * @param fileName
     */
    private saveAsWorkAround(blob: Blob, fileName: string): Promise<boolean> {
        return new Promise((resolve, reject) => {
            if (this.runningContextService.isCordova) {
                let folder = device.platform.toUpperCase().indexOf("OS") !== -1
                    ? cordova.file.documentsDirectory
                    : cordova.file.externalRootDirectory;
                (window as any).resolveLocalFileSystemURL(folder,
                    (directoryEntry) => {
                        directoryEntry.getDirectory("IsraelHikingMap",
                            { create: true },
                            dir => {
                                let fullFileName = new Date().toISOString().split(":").join("-").replace("T", "_")
                                    .replace("Z", "_") +
                                    fileName.split(" ").join("_");
                                dir.getFile(fullFileName,
                                    { create: true },
                                    fileEntry => {
                                        fileEntry.createWriter(fileWriter => {
                                            fileWriter.write(blob);
                                            resolve(true);
                                        });
                                    },
                                    reject);
                            },
                            reject);
                    },
                    reject);
            } else {
                this.nonAngularObjectsFactory.saveAs(blob, fileName);
                resolve(false);
            }
        });
    }
}