import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { LayersService } from "./layers.service";
import { SidebarService } from "./sidebar.service";
import { DatabaseService } from "./database.service";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { ToggleOfflineAction } from "../reducers/layers.reducer";
import { SetOfflineMapsLastModifiedDateAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ApplicationState } from "../models/models";

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
                private readonly store: Store) {
    }

    public async initialize(): Promise<void> {
        let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        let userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (offlineState.isOfflineAvailable === true &&
            offlineState.lastModifiedDate == null &&
            userState.userInfo != null) {
            // In case the user has purchased the map and never downloaded them, and now starts the app
            return await this.downloadOfflineMaps(false);
        }
        if (offlineState.isOfflineAvailable === true &&
            offlineState.lastModifiedDate != null &&
            userState.userInfo != null) {
            // Check and migrate old databases if needed
            try {
                let needToMigrate = await this.fileService.renameOldDatabases();
                if (needToMigrate) {
                    await this.databaseService.migrateDatabasesIfNeeded();
                }
            } catch (ex) {
                this.loggingService.error("[Offline Download] Failed to migrate: " + (ex as Error).message);
            }

        }

    }

    public async downloadOfflineMaps(showMessage = true): Promise<void> {
        this.loggingService.info("[Offline Download] Starting downloading offline files");
        try {
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
        } catch (ex) {
            let typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
            switch (typeAndMessage.type) {
                case "timeout":
                    this.loggingService.error("[Offline Download] Failed to get download files list due to timeout");
                    break;
                case "client":
                    this.loggingService.error("[Offline Download] Failed to get download files list due to client side error: " +
                        typeAndMessage.message);
                    break;
                default:
                    this.loggingService.error("[Offline Download] Failed to get download files list due to server side error: " +
                        typeAndMessage.message);
            }
            if (showMessage) {
                this.toastService.warning(this.resources.unexpectedErrorPleaseTryAgainLater);
            }
        }
    }

    private async downloadOfflineFilesProgressAction(reportProgress: (progressValue: number) => void, fileNames: Record<string, string>):
        Promise<void> {
        this.loggingService.info("[Offline Download] Starting downloading offline files, last update: " +
        this.store.selectSnapshot((s: ApplicationState) => s.offlineState).lastModifiedDate);
        this.sidebarService.hide();
        let setBackToOffline = false;
        if (this.layersService.getSelectedBaseLayer().isOfflineOn) {
            this.store.dispatch(new ToggleOfflineAction(this.layersService.getSelectedBaseLayer().key, false));
            setBackToOffline = true;
        }
        try {
            let newestFileDate = new Date(0);
            let length = Object.keys(fileNames).length;
            for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
                let fileName = Object.keys(fileNames)[fileNameIndex];
                let fileDate = new Date(fileNames[fileName]);
                newestFileDate = fileDate > newestFileDate ? fileDate : newestFileDate;
                let token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
                if (fileName.endsWith(".mbtiles")) {
                    let dbFileName = fileName.replace(".mbtiles", ".db");
                    await this.fileService.downloadDatabaseFile(`${Urls.offlineFiles}/${fileName}`, dbFileName, token,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                    await this.databaseService.moveDownloadedDatabaseFile(dbFileName);
                } else {
                    let fileContent = await this.fileService.getFileContentWithProgress(`${Urls.offlineFiles}/${fileName}`,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                    await this.fileService.writeStyles(fileContent as Blob);
                }
                this.loggingService.info(`[Offline Download] Finished downloading ${fileName}`);
            }
            this.loggingService.info("[Offline Download] Finished downloading offline files, update date to: "
                + newestFileDate.toUTCString());
            this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(newestFileDate));
            this.toastService.success(this.resources.downloadFinishedSuccessfully + " " + this.resources.useTheCloudIconToGoOffline);
            this.sidebarService.show("layers");
        } finally {
            if (setBackToOffline) {
                this.store.dispatch(new ToggleOfflineAction(this.layersService.getSelectedBaseLayer().key, false));
            }
        }
    }

    private async getFilesToDownloadDictionary(): Promise<Record<string, string>> {
        let lastModified = this.store.selectSnapshot((s: ApplicationState) => s.offlineState).lastModifiedDate;
        let lastModifiedString = lastModified ? lastModified.toISOString() : null;
        let fileNames = await firstValueFrom(this.httpClient.get(Urls.offlineFiles, {
            params: { lastModified: lastModifiedString }
        }).pipe(timeout(5000)));
        this.loggingService.info(
            `[Offline Download] Got ${Object.keys(fileNames).length} files that needs to be downloaded ${lastModifiedString}`);
        return fileNames as Record<string, string>;
    }

    public async isExpired(): Promise<boolean> {
        try {
            await firstValueFrom(this.httpClient.get(Urls.offlineFiles, {
                params: { lastModified: null }
            }).pipe(timeout(5000)));
            return false;
        } catch (ex) {
            let typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
            return typeAndMessage.type === "server" && typeAndMessage.statusCode === 403;
        }

    }
}
