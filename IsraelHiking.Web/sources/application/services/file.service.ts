import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as L from "leaflet";

import { ImageResizeService } from "./image-resize.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export interface IFormatViewModel {
    label: string;
    outputFormat: string;
    extension: string;
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private readonly httpClient: HttpClient,
        private readonly imageResizeService: ImageResizeService,
        private readonly nonAngularObjectsFactory: NonAngularObjectsFactory) {
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

    public saveToFile = (fileName: string, format: string, dataContainer: Common.DataContainer): Promise<{}> => {
        let promise = this.httpClient.post(Urls.files + "?format=" + format, dataContainer).toPromise();
        promise.then((responseData: string) => {
            this.saveBytesResponseToFile(responseData, fileName);
        });
        return promise;
    }

    public async openFromFile(file: File): Promise<Common.DataContainer> {
        if (file.type === ImageResizeService.JPEG) {
            return await this.imageResizeService.resizeImageAndConvert(file);
        }
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(Urls.openFile, formData).toPromise() as Promise<Common.DataContainer>;
    }

    public uploadTrace(file: File): Promise<any> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(Urls.osmTrace, formData, { responseType: "text" }).toPromise();
    }

    // HM TODO: remove this?
    public uploadAnonymousImage(file: File): Promise<string> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(Urls.uploadAnonymousImage, formData, { responseType: "text" }).toPromise();
    }

    public openFromUrl = (url: string): Promise<Common.DataContainer> => {
        return this.httpClient.get(Urls.files + "?url=" + url).toPromise() as Promise<Common.DataContainer>;
    }

    private saveBytesResponseToFile = (data: string, fileName: string) => {
        let blobToSave = this.nonAngularObjectsFactory.b64ToBlob(data, "application/octet-stream");
        this.saveAsWorkAround(blobToSave, fileName);
    }

    /**
     * This is an ugly workaround suggested here:
     * https://github.com/eligrey/FileSaver.js/issues/330
     * @param blob
     * @param fileName
     */
    private saveAsWorkAround(blob: Blob, fileName: string) {
        if (L.Browser.mobile) {
            let reader = new FileReader();
            reader.onload = () => {
                if (L.Browser.chrome) {
                    // If chrome android
                    let save = document.createElement("a");

                    save.href = reader.result;
                    save.download = fileName;

                    document.body.appendChild(save);
                    save.click();
                    document.body.removeChild(save);
                    window.URL.revokeObjectURL(save.href);
                } else if (navigator.platform && navigator.platform.match(/iPhone|iPod|iPad/)) {
                    // If iPhone etc
                    let url = window.URL.createObjectURL(blob);
                    window.location.href = url;
                } else {
                    // Any other browser
                    this.nonAngularObjectsFactory.saveAs(blob, fileName);
                }
            };

            reader.readAsDataURL(blob);
        } else {
            // Desktop if safari
            if (L.Browser.safari) {
                let url = window.URL.createObjectURL(blob);
                window.location.href = url;
            } else {
                // If normal browser use package Filesaver.js
                this.nonAngularObjectsFactory.saveAs(blob, fileName);
            }
        }
    }
}