import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";
import { timeout } from "rxjs/operators";

import { LayersService } from "./layers/layers.service";
import { SidebarService } from "./sidebar.service";
import { DatabaseService } from "./database.service";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { ApplicationState } from "../models/models";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { ToggleOfflineAction } from "../reducres/layers.reducer";
import { SetOfflineLastModifiedAction } from "../reducres/offline.reducer";
import { Urls } from "../urls";

@Injectable()
export class OfflineFilesDownloadService {
    constructor(private readonly resources: ResourcesService,
                private readonly sidebarService: SidebarService,
                private readonly layersService: LayersService,
                private readonly databaseService: DatabaseService,
                private readonly fileService: FileService,
                private readonly loggingService: LoggingService,
                private readonly httpClient: HttpClient,
                private readonly toastService: ToastService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public async initialize(): Promise<void> {
        let offlineState = this.ngRedux.getState().offlineState;
        if (offlineState.isOfflineAvailable === false ||
            offlineState.lastModifiedDate != null ||
            offlineState.poisLastModifiedDate == null ||
            this.ngRedux.getState().userState.userInfo == null) {
                return;
            }
        return await this.downloadOfflineMaps();
    }

    public async downloadOfflineMaps(): Promise<void> {
        this.loggingService.info(`[Offline Download] Starting downloading offline files`);
        let fileNames = await this.getFilesToDownloadDictionary();
        if (Object.keys(fileNames).length === 0) {
            this.toastService.success(this.resources.allFilesAreUpToDate + " " + this.resources.useTheCloudIconToGoOffline);
            return;
        }

        this.toastService.progress({
            action: (progress) => this.downloadOfflineFilesProgressAction(progress, fileNames),
            showContinueButton: true,
            continueText: this.resources.largeFilesUseWifi
        });
    }

    private async downloadOfflineFilesProgressAction(reportProgress: (progressValue: number) => void, fileNames: {}): Promise<void> {
        this.loggingService.info("[Offline Download] Starting downloading offline files, last update: " +
            this.ngRedux.getState().offlineState.lastModifiedDate);
        this.sidebarService.hide();
        let setBackToOffline = false;
        if (this.layersService.getSelectedBaseLayer().isOfflineOn) {
            this.ngRedux.dispatch(new ToggleOfflineAction({ key: this.layersService.getSelectedBaseLayer().key, isOverlay: false }));
            setBackToOffline = true;
        }
        try {
            let newestFileDate = new Date(0);
            let length = Object.keys(fileNames).length;
            for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
                let fileName = Object.keys(fileNames)[fileNameIndex];
                let fileDate = new Date(fileNames[fileName]);
                newestFileDate = fileDate > newestFileDate ? fileDate : newestFileDate;
                let token = this.ngRedux.getState().userState.token;
                if (fileName.endsWith(".mbtiles")) {
                    await this.databaseService.closeDatabase(fileName.replace(".mbtiles", ""));
                    await this.fileService.downloadDatabaseFile(`${Urls.offlineFiles}/${fileName}`, fileName, token,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                } else {
                    let fileContent = await this.fileService.getFileContentWithProgress(`${Urls.offlineFiles}/${fileName}`,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                    await this.fileService.writeStyles(fileContent as Blob);
                }
                this.loggingService.info(`[Offline Download] Finished downloading ${fileName}`);
            }
            this.loggingService.info("[Offline Download] Finished downloading offline files, update date to: "
                + newestFileDate.toUTCString());
            this.ngRedux.dispatch(new SetOfflineLastModifiedAction({ lastModifiedDate: newestFileDate }));
            this.toastService.success(this.resources.downloadFinishedSuccessfully + " " + this.resources.useTheCloudIconToGoOffline);
            this.sidebarService.show("layers");
        } finally {
            if (setBackToOffline) {
                this.ngRedux.dispatch(new ToggleOfflineAction({ key: this.layersService.getSelectedBaseLayer().key, isOverlay: false }));
            }
        }
    }

    private async getFilesToDownloadDictionary(): Promise<{}> {
        let lastModified = this.ngRedux.getState().offlineState.lastModifiedDate;
        let fileNames = await this.httpClient.get(Urls.offlineFiles, {
            params: { lastModified: lastModified ? lastModified.toUTCString() : null }
        }).pipe(timeout(5000)).toPromise() as {};
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that needs to be downloaded`);
        return fileNames;
    }
}
