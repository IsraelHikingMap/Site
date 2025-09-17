import { EventEmitter, inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material/dialog";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { Urls } from "../urls";
import { OfflineManagementDialogComponent } from "../components/dialogs/offline-management-dialog.component";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { DeleteOfflineMapsTileAction, SetOfflineMapsLastModifiedDateAction } from "../reducers/offline.reducer";
import type { ApplicationState } from "../models";

@Injectable()
export class OfflineFilesDownloadService {
    private readonly fileService = inject(FileService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly matDialog = inject(MatDialog);
    private readonly store = inject(Store);

    private abortController = new AbortController();
    public tilesProgressChanged = new EventEmitter<{tileX: number, tileY: number, progressValue: number}>();

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

    public async downloadTile(tileX: number, tileY: number): Promise<"up-to-date" | "downloaded" | "error" | "aborted"> {
        this.loggingService.info("[Offline Download] Starting downloading offline files");
        try {
            const fileNamesForRoot = await this.getFilesToDownload();
            const fileNamesForTile = await this.getFilesToDownload(tileX, tileY);
            if (fileNamesForTile.length === 0 && fileNamesForRoot.length === 0) {
                this.loggingService.info("[Offline Download] No files to download, all files are up to date");
                return "up-to-date";
            }
            this.updateInProgressTilesList(tileX, tileY, 0);
            const fileNames = [...fileNamesForRoot, ...fileNamesForTile];
            const currentAbortController = this.abortController; // keep a referece to the current abort controller for the case of aborting and then downloading again
            await this.downloadOfflineFilesProgressAction(fileNames, fileNamesForRoot.length, tileX, tileY, currentAbortController);

            if (currentAbortController.signal.aborted) {
                return "aborted";
            }

            if (fileNamesForTile.length > 0) {
                this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(this.getNewestFileDateFromFileList(fileNamesForTile), tileX, tileY));
            }
            if (fileNamesForRoot.length > 0) {
                this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(this.getNewestFileDateFromFileList(fileNamesForRoot), undefined, undefined));
            }
            return "downloaded";
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
            return "error";
        } finally {
            this.abortController = new AbortController();
        }
    }

    private getNewestFileDateFromFileList(fileNames: [string, string][]): Date {
        let newestFileDate = new Date(0);
        for (const fileNameAndDate of fileNames) {
            const fileDate = new Date(fileNameAndDate[1]);
            if (fileDate > newestFileDate) {
                newestFileDate = fileDate;
            }
        }
        return newestFileDate;
    }

    private async downloadOfflineFilesProgressAction(fileNames: [string, string][], rootFilesCount: number, tileX: number, tileY: number, abortController: AbortController): Promise<void> {
        this.loggingService.info(`[Offline Download] Starting downloading offline files, total files: ${fileNames.length}, tile: ${tileX}-${tileY}`);
        const length = fileNames.length;
        for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
            const [fileName] = fileNames[fileNameIndex];
            if (abortController.signal.aborted) {
                this.loggingService.info("[Offline Download] Aborted downloading offline files, current file: " + fileName);
                return;
            }

            const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
            let fileDownloadUrl = `${Urls.offlineFiles}/${fileName}`;
            if (fileName.endsWith(".pmtiles")) {
                if (fileNameIndex >= rootFilesCount) {
                    fileDownloadUrl += `?tileX=${tileX}&tileY=${tileY}`;
                }
                await this.fileService.downloadFileToCacheAuthenticated(fileDownloadUrl, fileName, token,
                    (value) => this.updateInProgressTilesList(tileX, tileY, (value + fileNameIndex) * 100.0 / length), abortController);
                if (abortController.signal.aborted) {
                    return;
                }
                await this.fileService.moveFileFromCacheToDataDirectory(fileName);
            } else {
                const fileContent = await this.fileService.getFileContentWithProgress(fileDownloadUrl,
                    (value) => this.updateInProgressTilesList(tileX, tileY, (value + fileNameIndex) * 100.0 / length));
                await this.fileService.writeStyle(fileName, await this.fileService.getFileContent(fileContent as File));
            }
            this.loggingService.info(`[Offline Download] Finished downloading ${fileName}`);
        }
        this.loggingService.info(`[Offline Download] Finished downloading offline files, current tile: ${tileX}-${tileY}`);
    }

    private updateInProgressTilesList(tileX: number, tileY: number, progressValue: number) {
        this.tilesProgressChanged.emit({tileX, tileY, progressValue});
    }

    private async getFilesToDownload(tileX?: number, tileY?: number): Promise<[string, string][]> {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const lastModifiedString = offlineState.downloadedTiles ? offlineState.downloadedTiles[`${tileX}-${tileY}`]?.toISOString() : null;
        const params: Record<string, string> = {};
        if (lastModifiedString) {
            params.lastModified = lastModifiedString;
        };
        if (tileX != null && tileY != null) {
            params.tileX = tileX.toString();
            params.tileY = tileY.toString();
        }
        const fileNames = await firstValueFrom(this.httpClient.get<Record<string, string>>(Urls.offlineFiles, {params: params}).pipe(timeout(5000)));
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that needs to be downloaded ${lastModifiedString}`);
        if (Object.keys(fileNames).length === 0) {
            return [];
        }
        return Object.entries(fileNames).map(([key, value]) => [key, value] as [string, string]);
    }

    public abortCurrentDownload(): void {
        this.loggingService.info("[Offline Download] Aborting current download");
        this.abortController.abort();
    }

    public async deleteTile(tileX: number, tileY: number): Promise<void> {
        this.loggingService.info(`[Offline Download] Deleting tile ${tileX}-${tileY}`);
        this.store.dispatch(new DeleteOfflineMapsTileAction(tileX, tileY));
        // This assumes that the tiles that needs to be downloaded have the same names as the ones that needs to be deleted.
        // It looks for the download date, so there's a need to clean the date before this call, which is done above.
        const files = await this.getFilesToDownload(tileX, tileY);
        for (const [fileName] of files) {
            await this.fileService.deleteFileInDataDirectory(fileName);
        }
    }
}
