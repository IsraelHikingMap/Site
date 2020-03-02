import { Component } from "@angular/core";
import { MatDialogRef } from "@angular/material";
import { HttpClient, HttpEventType } from "@angular/common/http";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { DatabaseService } from "../../services/database.service";
import { Urls } from "../../urls";

@Component({
    selector: "download-progress-dialog",
    templateUrl: "download-progress-dialog.component.html"
})
export class DownloadProgressDialogComponent extends BaseMapComponent {
    public progressPersentage: number;
    public errorText: string;

    constructor(resources: ResourcesService,
                private readonly matDialogRef: MatDialogRef<DownloadProgressDialogComponent>,
                private readonly httpClient: HttpClient,
                private readonly fileService: FileService,
                private readonly databaseService: DatabaseService) {
        super(resources);
        this.progressPersentage = 0;
        this.startDownload();
    }

    private async startDownload() {
        // HM TODO: add last modified
        this.progressPersentage = 0;
        try {
            let fileNames = await this.httpClient.get(Urls.offlineFiles, { params: { lastModified: null } }).toPromise() as string[];
            for (let fileNameIndex = 0; fileNameIndex < fileNames.length; fileNameIndex++) {
                let fileName = fileNames[fileNameIndex];
                let fileContent = await new Promise((resolve, reject) => {
                    this.httpClient.get(`${Urls.offlineFiles}/${fileName}`, {
                        observe: "events",
                        responseType: "blob",
                        reportProgress: true
                    }).subscribe(event => {
                        if (event.type === HttpEventType.DownloadProgress) {
                            this.progressPersentage = (50.0 / fileNames.length) * (event.loaded / event.total) +
                                fileNameIndex * 100.0 / fileNames.length;
                        }
                        if (event.type === HttpEventType.Response) {
                            if (event.ok) {
                                resolve(event.body);
                            } else {
                                reject(new Error(event.statusText));
                            }
                        }
                    });
                });
                await this.fileService.openIHMfile(fileContent as Blob,
                    async (sourceName, content, percentage) => {
                        await this.databaseService.saveTilesContent(sourceName, content);
                        this.updateCounter(fileNames.length, fileNameIndex, percentage);
                    },
                    async (content: string) => {
                        await this.databaseService.storePois(JSON.parse(content).features);
                    },
                    async (content, percentage) => {
                        await this.databaseService.storeImages(JSON.parse(content));
                        this.updateCounter(fileNames.length, fileNameIndex, percentage);
                    },
                    (percentage) => {
                        this.updateCounter(fileNames.length, fileNameIndex, percentage);
                    });
                this.updateCounter(fileNames.length, fileNameIndex, 100);
            }
            this.matDialogRef.close();
        } catch (ex) {
            this.errorText = ex.message;
        }
    }

    private updateCounter(numberOfFile: number, fileNameIndex: number, percentage: number) {
        this.progressPersentage = (0.5 / numberOfFile) * (percentage) +
            (fileNameIndex * 2 + 1) * 50.0 / numberOfFile;
    }
}
