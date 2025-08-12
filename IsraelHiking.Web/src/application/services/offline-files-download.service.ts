import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { LayersService } from "./layers.service";
import { SidebarService } from "./sidebar.service";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { ToggleOfflineAction } from "../reducers/layers.reducer";
import { SetOfflineMapsLastModifiedDateAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ApplicationState } from "../models";

@Injectable()
export class OfflineFilesDownloadService {

    private readonly resources = inject(ResourcesService);
    private readonly sidebarService = inject(SidebarService);
    private readonly layersService = inject(LayersService);
    private readonly fileService = inject(FileService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    public async initialize(): Promise<void> {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (offlineState.isOfflineAvailable === true &&
            (offlineState.lastModifiedDate == null || offlineState.isPmtilesDownloaded === false) &&
            userState.userInfo != null) {
            // In case the user has purchased the map and never downloaded them, and now starts the app
            return await this.downloadOfflineMaps(false);
        }
    }

    public async downloadOfflineMaps(showMessage = true): Promise<void> {
        this.loggingService.info("[Offline Download] Starting downloading offline files");
        try {
            const fileNames = await this.getFilesToDownloadDictionary();
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
            const length = Object.keys(fileNames).length;
            for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
                const fileName = Object.keys(fileNames)[fileNameIndex];
                const fileDate = new Date(fileNames[fileName]);
                newestFileDate = fileDate > newestFileDate ? fileDate : newestFileDate;
                const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
                if (fileName.endsWith(".pmtiles")) {
                    await this.fileService.downloadFileToCacheAuthenticated(`${Urls.offlineFiles}/${fileName}`, fileName, token,
                        (value) => reportProgress((value + fileNameIndex) * 100.0 / length));
                    await this.fileService.moveFileFromCacheToDataDirectory(fileName);
                } else {
                    const fileContent = await this.fileService.getFileContentWithProgress(`${Urls.offlineFiles}/${fileName}`,
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
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        let lastModifiedString = offlineState.lastModifiedDate ? offlineState.lastModifiedDate.toISOString() : null;
        if (!offlineState.isPmtilesDownloaded) {
            this.loggingService.info("[Offline Download] This is the first time downloading pmtiles, downloading all files");
            lastModifiedString = null;
        }
        const fileNames = await firstValueFrom(this.httpClient.get(Urls.offlineFiles, {
            params: { 
                lastModified: lastModifiedString,
                pmtiles: true
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
