import { EventEmitter, inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { MatDialog } from "@angular/material/dialog";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { last } from "lodash-es";
import { Immutable } from "immer";
import pLimit from "p-limit";
import type { StyleSpecification } from "maplibre-gl";

import { Urls } from "../urls";
import { OfflineManagementDialogComponent } from "../components/dialogs/offline-management-dialog.component";
import { FileService } from "./file.service";
import { LoggingService } from "./logging.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { PmTilesService } from "./pmtiles.service";
import { DeleteOfflineMapsTileAction, SetOfflineMapsLastModifiedDateAction } from "../reducers/offline.reducer";
import type { ApplicationState, FileNameDateVersion, TileMetadataPerFile } from "../models";

@Injectable()
export class OfflineFilesDownloadService {
    private readonly resources = inject(ResourcesService);
    private readonly fileService = inject(FileService);
    private readonly loggingService = inject(LoggingService);
    private readonly httpClient = inject(HttpClient);
    private readonly matDialog = inject(MatDialog);
    private readonly toastService = inject(ToastService);
    private readonly pmtilesService = inject(PmTilesService);
    private readonly store = inject(Store);

    private metadata: Record<string, string> = {};
    private abortController = new AbortController();
    private downloadedFilesInCurrentSession: string[] = [];
    private _currentDownloadedTile: { tileX: number, tileY: number, progress: Record<number, number> } | null = null;

    public tilesProgressChanged = new EventEmitter<{ tileX: number, tileY: number, progressValue: number }>();
    public get currentDownloadedTile() {
        return this._currentDownloadedTile;
    }

    public async initialize(): Promise<void> {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        if (userState == null || offlineState.isSubscribed === false) {
            return;
        }
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            const needToAskToRedownload = offlineState.downloadedTiles == null || Object.values(offlineState.downloadedTiles).some(dt => !this.isTileCompatible(dt));
            if (!needToAskToRedownload) {
                for (const styleAndContent of styles) {
                    await this.fileService.writeStyle(styleAndContent.fileName, styleAndContent.content);
                }
                return;
            }
            this.toastService.confirm({
                type: "YesNo",
                message: this.resources.reccomendOfflineDownload,
                confirmAction: async () => {
                    OfflineManagementDialogComponent.openDialog(this.matDialog);
                }
            });
        } catch {
            // ignore in case this happens in offline
        }
    }

    private async downloadStyleAndUpdateMetadata(): Promise<{ fileName: string, content: string }[]> {
        const styles: { fileName: string, content: string }[] = [];
        for (const baseLayerUrl of [Urls.HIKING_TILES_ADDRESS, Urls.MTB_TILES_ADDRESS]) {
            const style = await firstValueFrom(this.httpClient.get(baseLayerUrl, { responseType: "text" }).pipe(timeout(5000)));
            styles.push({ fileName: last(baseLayerUrl.split("/")), content: style });
        }
        this.metadata = {};
        for (const style of styles) {
            this.metadata = Object.assign(this.metadata, (JSON.parse(style.content) as StyleSpecification).metadata as Record<string, string>);
        }
        return styles;
    }

    public async downloadTile(tileX: number, tileY: number): Promise<"up-to-date" | "downloaded" | "error" | "aborted"> {
        this._currentDownloadedTile = { tileX, tileY, progress: {} };
        this.loggingService.info("[Offline Download] Starting downloading offline files");
        try {
            const styles = await this.downloadStyleAndUpdateMetadata();
            for (const styleAndContent of styles) {
                await this.fileService.writeStyle(styleAndContent.fileName, styleAndContent.content);
            }
            const fileNamesForRoot = await this.getFilesToDownload();
            const fileNamesForTile = await this.getFilesToDownload(tileX, tileY);
            if (fileNamesForTile.length === 0 && fileNamesForRoot.length === 0) {
                this.loggingService.info("[Offline Download] No files to download, all files are up to date");
                return "up-to-date";
            }
            this.updateInProgressTilesList(0, -1, 0);
            const fileNames = [...fileNamesForRoot, ...fileNamesForTile];
            const nonPmtilesFile = fileNames.find(f => !f.fileName.endsWith(".pmtiles"))
            if (nonPmtilesFile) {
                this.loggingService.info("[Offline Download] Some files are not pmtiles, skipping: " + nonPmtilesFile.fileName);
            }
            const currentAbortController = this.abortController; // keep a referece to the current abort controller for the case of aborting and then downloading again
            await this.downloadOfflineFilesProgressAction(fileNames, fileNamesForRoot.length, currentAbortController);

            if (currentAbortController.signal.aborted) {
                return "aborted";
            }

            if (fileNamesForTile.length > 0) {
                this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(await this.getMetadataPerFile(fileNamesForTile), tileX, tileY));
            }
            if (fileNamesForRoot.length > 0) {
                this.store.dispatch(new SetOfflineMapsLastModifiedDateAction(await this.getMetadataPerFile(fileNamesForRoot), undefined, undefined));
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
            this._currentDownloadedTile = null;
        }
    }

    private async getMetadataPerFile(fileNames: FileNameDateVersion[]): Promise<TileMetadataPerFile> {
        const metadata: FileNameDateVersion[] = []
        for (const fileNameAndDate of fileNames) {
            try {
                const version = await this.pmtilesService.getVersion(fileNameAndDate.fileName);
                metadata.push({ fileName: fileNameAndDate.fileName, date: fileNameAndDate.date, version });
            } catch (ex) {
                this.loggingService.error(`[Offline Download] Failed to get version for file: ${fileNameAndDate.fileName}, error: ${ex}`);
            }
        }
        return metadata;
    }

    private async downloadOfflineFilesProgressAction(fileNames: FileNameDateVersion[], rootFilesCount: number, abortController: AbortController): Promise<void> {
        const { tileX, tileY } = this._currentDownloadedTile!;
        this.loggingService.info(`[Offline Download] Starting downloading offline files, total files: ${fileNames.length}, tile: ${tileX}-${tileY}`);
        const length = fileNames.length;
        const fileDownloadPromises: Promise<void>[] = [];
        const limit = pLimit(3);
        for (let fileNameIndex = 0; fileNameIndex < length; fileNameIndex++) {
            const { fileName } = fileNames[fileNameIndex];
            if (abortController.signal.aborted) {
                this.loggingService.info("[Offline Download] Aborted downloading offline files, current file: " + fileName);
                return;
            }
            if (this.downloadedFilesInCurrentSession.includes(fileName)) {
                this.loggingService.info("[Offline Download] File already downloaded recently, skipping: " + fileName);
                this.updateInProgressTilesList(1, fileNameIndex, length);
                continue;
            }
            const token = this.store.selectSnapshot((s: ApplicationState) => s.userState).token;
            let fileDownloadUrl = `${Urls.offlineFiles}/${fileName}`;
            if (fileNameIndex >= rootFilesCount) {
                fileDownloadUrl += `?tileX=${tileX}&tileY=${tileY}`;
            }

            fileDownloadPromises.push(limit(() => this.downloadAndMove(fileName, fileDownloadUrl, token, abortController, fileNameIndex, length)));
        }
        await Promise.all(fileDownloadPromises);
        this.downloadedFilesInCurrentSession = [];
        this.loggingService.info(`[Offline Download] Finished downloading offline files, current tile: ${tileX}-${tileY}`);
    }

    private async downloadAndMove(fileName: string, fileDownloadUrl: string, token: string, abortController: AbortController, fileNameIndex: number, length: number) {
        await this.fileService.downloadFileToCacheAuthenticated(fileDownloadUrl, fileName, token,
            (value) => this.updateInProgressTilesList(value, fileNameIndex, length), abortController);
        if (abortController.signal.aborted) {
            return;
        }
        await this.fileService.moveFileFromCacheToDataDirectory(fileName);
        this.downloadedFilesInCurrentSession.push(fileName);
        this.loggingService.info(`[Offline Download] Finished downloading ${fileName}`);
    }

    private updateInProgressTilesList(progressValue: number, fileNameIndex: number, length: number) {
        if (this._currentDownloadedTile == null) {
            return;
        }
        if (fileNameIndex == -1) {
            this.tilesProgressChanged.emit({ tileX: this._currentDownloadedTile.tileX, tileY: this._currentDownloadedTile.tileY, progressValue: 0 });
            return;
        }
        this._currentDownloadedTile.progress[fileNameIndex] = progressValue;
        const totalProgress = Object.values(this._currentDownloadedTile.progress).reduce((a, b) => a + b, 0) / length;
        this.tilesProgressChanged.emit({ tileX: this._currentDownloadedTile.tileX, tileY: this._currentDownloadedTile.tileY, progressValue: totalProgress * 100.0 });
    }

    private async getFilesToDownload(tileX?: number, tileY?: number): Promise<FileNameDateVersion[]> {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        const lastModifiedString = offlineState.downloadedTiles ? this.getLastModifiedDate(offlineState.downloadedTiles[`${tileX}-${tileY}`])?.toISOString() : null;
        const params: Record<string, string> = {};
        if (lastModifiedString) {
            params.lastModified = lastModifiedString;
        };
        if (tileX != null && tileY != null) {
            params.tileX = tileX.toString();
            params.tileY = tileY.toString();
        }
        const fileNames = await firstValueFrom(this.httpClient.get<Record<string, string>>(Urls.offlineFiles, { params: params }).pipe(timeout(5000)));
        this.loggingService.info(`[Offline Download] Got ${Object.keys(fileNames).length} files that needs to be downloaded ${lastModifiedString}`);
        if (Object.keys(fileNames).length === 0) {
            return [];
        }
        return Object.entries(fileNames).map(([key, value]) => ({ fileName: key, date: value }));
    }

    public abortCurrentDownload(): void {
        this.loggingService.info("[Offline Download] Aborting current download");
        this.abortController.abort();
        this.abortController = new AbortController(); // in case finally is never called due to download stuck.
        this._currentDownloadedTile = null;
    }

    public async deleteTile(tileX: number, tileY: number): Promise<void> {
        this.loggingService.info(`[Offline Download] Deleting tile ${tileX}-${tileY}`);
        this.store.dispatch(new DeleteOfflineMapsTileAction(tileX, tileY));
        // This assumes that the tiles that needs to be downloaded have the same names as the ones that needs to be deleted.
        // It looks for the download date, so there's a need to clean the date before this call, which is done above.
        const files = await this.getFilesToDownload(tileX, tileY);
        for (const { fileName } of files) {
            await this.fileService.deleteFileInDataDirectory(fileName);
        }
        const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.offlineState.downloadedTiles);
        if (downloadedTiles && Object.keys(downloadedTiles).length === 1) {
            this.deleteTile(undefined, undefined);
        }
    }

    public getLastModifiedDate(downloadedTile: Immutable<TileMetadataPerFile>) {
        if (!downloadedTile) {
            return null;
        }
        let lastModified = new Date(0);
        if (Array.isArray(downloadedTile)) {
            for (const fileDateVersion of downloadedTile as FileNameDateVersion[]) {
                const fileUpdateDate = new Date(fileDateVersion.date);
                if (fileUpdateDate > lastModified) {
                    lastModified = new Date(fileDateVersion.date)
                }
            }
        } else {
            lastModified = new Date(downloadedTile as Date);
        }
        return lastModified;
    }

    public isTileCompatible(downloadedTile: Immutable<TileMetadataPerFile>): boolean {
        if (!Array.isArray(downloadedTile)) {
            return Object.keys(this.metadata).every(k => !k.includes("min-version"));
        }
        for (const fileDateVersion of downloadedTile as FileNameDateVersion[]) {
            const fileVersion = fileDateVersion.version;
            const sourceName = fileDateVersion.fileName.split("+")[0];
            const styleVersion = this.metadata[`sources:${sourceName}:min-version`];
            if (fileVersion && styleVersion && fileVersion.localeCompare(styleVersion, undefined, { numeric: true, sensitivity: "base" }) === -1) {
                return false;
            }
        }
        return true;
    }
}
