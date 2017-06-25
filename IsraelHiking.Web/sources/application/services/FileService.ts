﻿import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import { AuthorizationService } from "./AuthorizationService";
import { Urls } from "../common/Urls";
import "rxjs/add/operator/toPromise";
import * as Common from "../common/IsraelHiking";
import { saveAs } from "file-saver";

export interface IFormatViewModel {
    label: string,
    outputFormat: string,
    extension: string,
}

@Injectable()
export class FileService {
    public formats: IFormatViewModel[];

    constructor(private http: Http,
        private authorizationService: AuthorizationService) {
        this.formats = [];
        this.http.get(Urls.fileFormats).toPromise().then((response) => {
            this.formats.splice(0);
            for (let format of response.json()) {
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
        let promise = this.http.post(Urls.files + "?format=" + format, dataContainer).toPromise();
        promise.then((responseData) => {
            this.saveBytesResponseToFile(responseData.json(), fileName);
        });
        return promise;
    }

    public openFromFile(file: File): Promise<Common.DataContainer> {
        return new Promise((resolve, reject) => {

            let xhr: XMLHttpRequest = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve(<Common.DataContainer>JSON.parse(xhr.response));
                    } else {
                        reject(xhr.response);
                    }
                }
            };

            xhr.open('POST', Urls.openFile, true);
            this.authorizationService.setXhrHeader(xhr);

            let formData = new FormData();
            formData.append("file", file, file.name);
            xhr.send(formData);
        });
    }

    public upload(url: string, file: File): Promise<Response> {
        return new Promise((resolve, reject) => {

            let xhr: XMLHttpRequest = new XMLHttpRequest();
            xhr.onreadystatechange = () => {
                if (xhr.readyState === 4) {
                    if (xhr.status === 200) {
                        resolve(xhr.response);
                    } else {
                        reject(xhr.response);
                    }
                }
            };

            xhr.open('POST', Urls.openFile, true);
            

            let formData = new FormData();
            formData.append("file", file, file.name);
            xhr.send(formData);
        });
    }

    public openFromUrl = (url: string): Promise<Response> => {
        return this.http.get(Urls.files + "?url=" + url, this.authorizationService.getHeader()).toPromise();
    }

    private saveBytesResponseToFile = (data: any, fileName: string) => {
        var byteCharacters = atob(data);
        var byteNumbers = new Array(byteCharacters.length);
        for (let i = 0; i < byteCharacters.length; i++) {
            byteNumbers[i] = byteCharacters.charCodeAt(i);
        }
        var byteArray = new Uint8Array(byteNumbers);
        var blobToSave = new Blob([byteArray], { type: "application/octet-stream" });
        saveAs(blobToSave, fileName);
    }
}