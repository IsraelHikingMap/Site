import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { saveAs } from "file-saver";
import * as L from "leaflet";

import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export interface IFormatViewModel {
    label: string,
    outputFormat: string,
    extension: string,
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private httpClient: HttpClient) {
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

    public saveToFile = (fileName: string, format: string, dataContainer: Common.DataContainer): Promise<{}> => {
        let promise = this.httpClient.post(Urls.files + "?format=" + format, dataContainer).toPromise();
        promise.then((responseData) => {
            this.saveBytesResponseToFile(responseData, fileName);
        });
        return promise;
    }

    public openFromFile(file: File): Promise<Common.DataContainer> {
        return this.upload(Urls.openFile, file);
    }

    public upload(url: string, file: File): Promise<any> {
        let formData = new FormData();
        formData.append("file", file, file.name);
        return this.httpClient.post(url, formData, { responseType: "text" }).toPromise();
    }

    public openFromUrl = (url: string): Promise<Common.DataContainer> => {
        return this.httpClient.get(Urls.files + "?url=" + url).toPromise() as Promise<Common.DataContainer>;
    }

    private saveBytesResponseToFile = (data: any, fileName: string) => {
        var byteCharacters = atob(data);
        var byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        var byteArray = new Uint8Array(byteNumbers);
        var blobToSave = new Blob([byteArray], { type: "application/octet-stream" });
        //saveAs(blobToSave, fileName);
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
                // If chrome android
                if (L.Browser.chrome) {
                    let save = document.createElement("a");

                    save.href = reader.result;
                    save.download = fileName;

                    document.body.appendChild(save);
                    save.click();
                    document.body.removeChild(save);
                    window.URL.revokeObjectURL(save.href);
                }
                // If iPhone etc
                else if (navigator.platform && navigator.platform.match(/iPhone|iPod|iPad/)) {
                    let url = window.URL.createObjectURL(blob);
                    window.location.href = url;
                }
                else {
                    // Any other browser
                    saveAs(blob, fileName);
                }
            };

            reader.readAsDataURL(blob);
        }
        else {
            //Desktop if safari
            if (L.Browser.safari) {
                let url = window.URL.createObjectURL(blob);
                window.location.href = url;
            }
            else {
                // If normal browser use package Filesaver.js
                saveAs(blob, fileName);
            }
        }
    }
}