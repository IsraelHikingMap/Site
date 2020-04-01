import { Component } from "@angular/core";
import { MatDialogRef, MatDialog } from "@angular/material";
import { HttpClient, HttpEventType } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { DatabaseService } from "../../services/database.service";
import { ToastService } from "../../services/toast.service";
import { LoggingService } from "../../services/logging.service";
import { LayersService } from "../../services/layers/layers.service";
import { Urls } from "../../urls";
import { SetOfflineLastModifiedAction } from "../../reducres/offline.reducer";
import { ApplicationState } from "../../models/models";
import { ToggleOfflineAction } from "../../reducres/layers.reducer";

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
                private readonly databaseService: DatabaseService,
                private readonly toastService: ToastService,
                private readonly loggingService: LoggingService,
                private readonly layersService: LayersService,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        super(resources);
        this.progressPersentage = 0;
        this.startDownload();
    }

    public static openDialog(dialog: MatDialog) {
        dialog.open(DownloadProgressDialogComponent, {
            hasBackdrop: false,
            closeOnNavigation: false,
            disableClose: true,
            position: {
                top: "5px",
            },
            width: "80%"
        });
    }

    private async startDownload() {
        let setBackToOffline = false;
        if (this.layersService.getSelectedBaseLayer().isOfflineOn) {
            this.ngRedux.dispatch(new ToggleOfflineAction({ key: this.layersService.getSelectedBaseLayer().key, isOverlay: false }));
            setBackToOffline = true;
        }
        try {
            let fileNames = await this.getFilesDictionary();
            length = Object.keys(fileNames).length;
            let newestFileDate = new Date(0);
            for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
                let fileName = Object.keys(fileNames)[fileNameIndex];
                let fileDate = new Date(fileNames[fileName]);
                newestFileDate = fileDate > newestFileDate ? fileDate : newestFileDate;
                let fileContent = await this.getFileContent(fileName, fileNameIndex);
                if (fileName.endsWith(".mbtiles")) {
                    await this.databaseService.closeDatabase(fileName.replace(".mbtiles", ""));
                    await this.fileService.saveToDatabasesFolder(fileContent as Blob, fileName);
                } else {
                    await this.fileService.openIHMfile(fileContent as Blob,
                        async (content: string) => {
                            await this.databaseService.storePois(JSON.parse(content).features);
                        },
                        async (content, percentage) => {
                            await this.databaseService.storeImages(JSON.parse(content));
                            this.updateCounter(length, fileNameIndex, percentage);
                        }
                    );
                }
                this.updateCounter(length, fileNameIndex, 100);
            }
            if (length === 0) {
                this.loggingService.info("All offline files are up-to-date");
                this.matDialogRef.close();
                this.toastService.success(this.resources.allFilesAreUpToDate);
            } else {
                this.loggingService.info("Finished downloading offline files, update date to: " + newestFileDate.toUTCString());
                this.ngRedux.dispatch(new SetOfflineLastModifiedAction({ lastModifiedDate: newestFileDate }));
                this.matDialogRef.close();
                this.toastService.success(this.resources.downloadFinishedSuccessfully);
            }
        } catch (ex) {
            this.errorText = ex.message;
        } finally {
            if (setBackToOffline) {
                this.ngRedux.dispatch(new ToggleOfflineAction({ key: this.layersService.getSelectedBaseLayer().key, isOverlay: false }));
            }
        }
    }

    private updateCounter(numberOfFile: number, fileNameIndex: number, percentage: number) {
        this.progressPersentage = (0.5 / numberOfFile) * (percentage) +
            (fileNameIndex * 2 + 1) * 50.0 / numberOfFile;
    }

    private async getFilesDictionary(): Promise<{}> {
        let lastModified = this.ngRedux.getState().offlineState.lastModifiedDate;
        return await this.httpClient.get(Urls.offlineFiles, {
            params: {
                lastModified: lastModified ? lastModified.toUTCString() : null,
                mbTiles: "true"
            }
        }).toPromise() as {};
    }

    private async getFileContent(fileName: string, fileNameIndex: number) {
        return new Promise((resolve, reject) => {
            this.httpClient.get(`${Urls.offlineFiles}/${fileName}`, {
                observe: "events",
                responseType: "blob",
                reportProgress: true
            }).subscribe(event => {
                if (event.type === HttpEventType.DownloadProgress) {
                    this.progressPersentage = (50.0 / length) * (event.loaded / event.total) +
                        fileNameIndex * 100.0 / length;
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
}
