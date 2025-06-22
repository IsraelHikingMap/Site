import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material/dialog";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { LayersService } from "./layers.service";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { OfflineManagementDialogComponent } from "application/components/dialogs/offline-management-dialog.component";
import { ToggleOfflineAction } from "../reducers/layers.reducer";
import { SetOfflineMapsLastModifiedDateAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ApplicationState } from "../models/models";

@Injectable()
export class OfflineFilesDownloadService {

    private readonly resources = inject(ResourcesService);
    private readonly layersService = inject(LayersService);
    private readonly fileService = inject(FileService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly matDialog = inject(MatDialog);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    public async initialize(): Promise<void> {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (offlineState.isSubscribed === true &&
            offlineState.downloadedTiles == null &&
            userState.userInfo != null) {
            // In case the user has purchased the map and never downloaded them, and now starts the app
            OfflineManagementDialogComponent.openDialog(this.matDialog);
        }
    }

    public async downloadTile(tileX: number, tileY: number, reportProgress: (progressValue: number) => void): Promise<void> {
        this.loggingService.info("[Offline Download] Starting downloading offline files");
        try {
            const fileNames = await this.getFilesToDownloadDictionary(tileX, tileY);
            if (Object.keys(fileNames).length === 0) {
                this.toastService.success(this.resources.allFilesAreUpToDate + " " + this.resources.useTheCloudIconToGoOffline);
                return;
            }

            const newestFileDate = await this.downloadOfflineFilesProgressAction(reportProgress, fileNames);
            this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(newestFileDate, tileX, tileY));
            // HM TODO: think about zoom 6 repeated download?
        } catch (ex) {
            const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
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
        }
    }

    private async downloadOfflineFilesProgressAction(reportProgress: (progressValue: number) => void, fileNames: Record<string, string>):
        Promise<Date> {
        this.loggingService.info(`[Offline Download] Starting downloading offline files, total files: ${Object.keys(fileNames).length}`);
        let setBackToOffline = false;
        if (this.layersService.getSelectedBaseLayer().isOfflineOn) {
            this.store.dispatch(new ToggleOfflineAction(this.layersService.getSelectedBaseLayer().key, false));
            setBackToOffline = true;
        }
        try {
            let newestFileDate = new Date(0);
            const length = Object.keys(fileNames).length;
            for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
                const fileName = Object.keys(fileNames)[fileNameIndex];
                const fileDate = new Date(fileNames[fileName]);
                newestFileDate = fileDate > newestFileDate ? fileDate : newestFileDate;
                const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
                if (fileName.endsWith(".pmtiles")) {
                    // HM TODO: think about this!
                    const folderlessFileName = fileName.replace(/\//g, "--")
                    await this.fileService.downloadFileToCacheAuthenticated(`${Urls.offlineFiles}/${encodeURIComponent(encodeURIComponent(fileName))}`, folderlessFileName, token,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                    await this.fileService.moveFileFromCacheToDataDirectory(folderlessFileName);
                } else {
                    const fileContent = await this.fileService.getFileContentWithProgress(`${Urls.offlineFiles}/${fileName}`,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                    await this.fileService.writeStyles(fileContent as Blob);
                }
                this.loggingService.info(`[Offline Download] Finished downloading ${fileName}`);
            }
            this.loggingService.info("[Offline Download] Finished downloading offline files, update date to: "
                + newestFileDate.toUTCString());
            
            this.toastService.success(this.resources.downloadFinishedSuccessfully + " " + this.resources.useTheCloudIconToGoOffline);
            return newestFileDate;
        } finally {
            if (setBackToOffline) {
                this.store.dispatch(new ToggleOfflineAction(this.layersService.getSelectedBaseLayer().key, false));
            }
        }
    }

    private async getFilesToDownloadDictionary(tileX: number, tileY: number): Promise<Record<string, string>> {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const lastModifiedString = offlineState.downloadedTiles ? offlineState.downloadedTiles[`${tileX}-${tileY}`]?.toISOString() : null;
        const fileNames = await firstValueFrom(this.httpClient.get(Urls.offlineFiles, {
            params: { 
                lastModified: lastModifiedString,
                tileX: tileX.toString(),
                tileY: tileY.toString()
            }
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
            const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
            return typeAndMessage.type === "server" && typeAndMessage.statusCode === 403;
        }

    }
}
