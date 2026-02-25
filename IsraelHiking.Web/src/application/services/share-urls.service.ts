import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Router } from "@angular/router";
import { timeout } from "rxjs/operators";
import { orderBy } from "lodash-es";
import { Store } from "@ngxs/store";
import { firstValueFrom } from "rxjs";
import type { Immutable } from "immer";

import { RouteStrings } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { SetShareUrlAction } from "../reducers/in-memory.reducer";
import { UpdateShareUrlAction, RemoveShareUrlAction, AddShareUrlAction, SetShareUrlsLastModifiedDateAction } from "../reducers/share-urls.reducer";
import { SpatialService } from "./spatial.service";
import { Urls } from "../urls";
import type { ShareUrl, ApplicationState, UserPermissions } from "../models";

interface IShareUrlSocialLinks {
    facebook: string;
    whatsapp: string;
    app: string;
}

@Injectable()
export class ShareUrlsService {
    private syncing = false;

    private readonly httpClient = inject(HttpClient);
    private readonly router = inject(Router);
    private readonly whatsAppService = inject(WhatsAppService);
    private readonly loggingService = inject(LoggingService);
    private readonly databaseService = inject(DatabaseService);
    private readonly store = inject(Store);

    public async initialize() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo == null) {
            return;
        }
        this.syncShareUrls();
    }

    public getShareUrlDisplayName(shareUrl: Immutable<ShareUrl>): string {
        return shareUrl.description ? `${shareUrl.title} - ${shareUrl.description}` : shareUrl.title;
    }

    public getShareSocialLinks(shareUrl: Immutable<ShareUrl>): IShareUrlSocialLinks {
        if (shareUrl == null) {
            return {
                app: "",
                facebook: "",
                whatsapp: "",
            };
        }
        const app = this.getFullUrlFromShareId(shareUrl.id);
        const escaped = encodeURIComponent(app);
        return {
            app: app,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsAppService.getUrl(this.getShareUrlDisplayName(shareUrl), escaped) as string
        };
    }

    private async getShareFromServerAndCacheIt(shareUrlId: string, timeToWait = 60000): Promise<ShareUrl> {
        this.loggingService.info(`[Shares] Getting share by id ${shareUrlId}`);
        const shareUrl = await firstValueFrom(this.httpClient.get<ShareUrl>(Urls.urls + shareUrlId).pipe(timeout(timeToWait)));
        shareUrl.start = shareUrl.start ?? shareUrl.dataContainer.routes?.[0]?.segments?.[0]?.latlngs?.[0];
        shareUrl.start = shareUrl.start ?? SpatialService.getLatlngInterpolatedValue(shareUrl.dataContainer.northEast, shareUrl.dataContainer.southWest, 0.5);
        this.databaseService.storeShareUrl(shareUrl);
        return shareUrl;
    }

    public async getShareUrl(shareUrlId: string): Promise<ShareUrl> {
        let shareUrl = await this.databaseService.getShareUrlById(shareUrlId);
        if (shareUrl == null) {
            return await this.getShareFromServerAndCacheIt(shareUrlId);
        }
        // Refresh it in the background if needed...
        try {
            const timestamp = await firstValueFrom(this.httpClient.get<string>(Urls.urls + shareUrlId + "/timestamp").pipe(timeout(2000)));
            if (new Date(timestamp) <= new Date(shareUrl.lastModifiedDate)) {
                return shareUrl;
            }
            this.loggingService.warning(`[Shares] Cached share is outdated ${shareUrlId}, fetching it again...`);
            shareUrl = await this.getShareFromServerAndCacheIt(shareUrlId, 5000);
            return shareUrl;
        } catch {
            this.loggingService.error(`[Shares] Failed to get share fast ${shareUrlId}, refreshing in the background`);
            this.getShareFromServerAndCacheIt(shareUrlId); // don't wait for it...
            return shareUrl;
        }
    }

    public async syncShareUrls(): Promise<any> {
        if (this.syncing) {
            this.loggingService.info("[Shares] Already syncing...");
            return;
        }
        this.syncing = true;
        try {
            const sharesLastSuccessfullSync = this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState).shareUrlsLastModifiedDate;
            const operationStartTimeStamp = new Date();
            let sharesToGetFromServer = [] as ShareUrl[];
            this.loggingService.info("[Shares] Starting shares sync, last modified: " +
                (sharesLastSuccessfullSync || new Date(0)).toUTCString());
            const shareUrls = await firstValueFrom(this.httpClient.get<ShareUrl[]>(Urls.urls).pipe(timeout(20000)));
            this.loggingService.info("[Shares] Got the list of shares, starting to compare against exiting list");
            const exitingShareUrls = this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState).shareUrls;
            for (const shareUrl of shareUrls) {
                shareUrl.type = shareUrl.type ?? "Unknown";
                shareUrl.difficulty = shareUrl.difficulty ?? "Unknown";
                shareUrl.length = shareUrl.length ?? 0;
                shareUrl.gain = shareUrl.gain ?? 0;
                shareUrl.loss = shareUrl.loss ?? 0;
                const exitingShareUrl = exitingShareUrls.find(s => s.id === shareUrl.id);
                if (exitingShareUrl != null) {
                    shareUrl.start = shareUrl.start ?? exitingShareUrl.start;
                    this.store.dispatch(new UpdateShareUrlAction(shareUrl));
                } else {
                    this.store.dispatch(new AddShareUrlAction(shareUrl));
                }
                if (sharesLastSuccessfullSync == null || new Date(shareUrl.lastModifiedDate) > sharesLastSuccessfullSync) {
                    sharesToGetFromServer.push(shareUrl);
                }
            }
            for (const shareUrl of exitingShareUrls) {
                if (shareUrls.find(s => s.id === shareUrl.id) == null) {
                    this.store.dispatch(new RemoveShareUrlAction(shareUrl.id));
                    await this.databaseService.deleteShareUrlById(shareUrl.id);
                }
            }
            sharesToGetFromServer = orderBy(sharesToGetFromServer, s => s.lastModifiedDate, "asc");
            for (const shareToGet of sharesToGetFromServer) {
                await this.getShareFromServerAndCacheIt(shareToGet.id);
                this.store.dispatch(new SetShareUrlsLastModifiedDateAction(new Date(shareToGet.lastModifiedDate)));
            }

            await this.updateShareUrlStart(shareUrls);
            this.store.dispatch(new SetShareUrlsLastModifiedDateAction(operationStartTimeStamp));
            this.loggingService.info(`[Shares] Finished shares sync, last modified: ${operationStartTimeStamp.toUTCString()}`);
        } catch (ex) {
            this.loggingService.error("[Shares] Unable to sync shares: " + (ex as Error).message);
        } finally {
            this.syncing = false;
        }
    }

    /** 
     * Updates the start location of share urls that don't have it.
     * This is needed because old share urls don't have the start location.
     */
    private async updateShareUrlStart(shareUrls: Immutable<ShareUrl>[]) {
        for (const shareUrl of shareUrls.filter(s => s.start == null)) {
            let fullShareUrl = await this.databaseService.getShareUrlById(shareUrl.id);
            if (fullShareUrl?.dataContainer == null || fullShareUrl?.start == null) {
                await this.databaseService.deleteShareUrlById(shareUrl.id);
                fullShareUrl = await this.getShareFromServerAndCacheIt(shareUrl.id);
            }
            try {
                if (fullShareUrl != null) {
                    const shareToUpdate = structuredClone(shareUrl) as ShareUrl;
                    shareToUpdate.start = fullShareUrl.dataContainer.routes?.[0]?.segments?.[0]?.latlngs?.[0];
                    shareToUpdate.start = shareToUpdate.start ?? SpatialService.getLatlngInterpolatedValue(fullShareUrl.dataContainer.northEast, fullShareUrl.dataContainer.southWest, 0.5);
                    this.store.dispatch(new UpdateShareUrlAction(shareToUpdate));
                }
            } catch (ex) {
                this.loggingService.error("[Shares] Unable to get share start for " + shareUrl.id + " " + (ex as Error).message);
            }
        }
    }

    public async createShareUrl(shareUrl: ShareUrl): Promise<Immutable<ShareUrl>> {
        this.loggingService.info(`[Shares] Creating share with title: ${shareUrl.title}`);
        const createdShareUrl = await firstValueFrom(this.httpClient.post<ShareUrl>(Urls.urls, shareUrl));
        this.store.dispatch(new AddShareUrlAction(createdShareUrl));
        return createdShareUrl;
    }

    public async updateShareUrl(shareUrl: ShareUrl): Promise<Immutable<ShareUrl>> {
        this.loggingService.info(`[Shares] Updating share with id: ${shareUrl.id}`);
        const updatedShareUrl = await firstValueFrom(this.httpClient.put<ShareUrl>(Urls.urls + shareUrl.id, shareUrl));
        this.store.dispatch(new UpdateShareUrlAction(updatedShareUrl));
        return updatedShareUrl;
    }

    public async deleteShareUrl(shareUrl: Immutable<ShareUrl>): Promise<void> {
        this.loggingService.info(`[Shares] Deleting share with id: ${shareUrl.id} ${shareUrl.title}`);
        await firstValueFrom(this.httpClient.delete(Urls.urls + shareUrl.id));
        this.store.dispatch(new RemoveShareUrlAction(shareUrl.id));
        await this.databaseService.deleteShareUrlById(shareUrl.id);
    }

    public getImageUrlFromShareId(shareUrlId: string, width?: number, height?: number) {
        let address = Urls.urls + shareUrlId + "/thumbnail";
        if (width && height) {
            address += `?width=${width}&height=${height}`;
        }
        return address;
    }

    public setShareUrl(shareUrl: Immutable<ShareUrl>) {
        this.store.dispatch(new SetShareUrlAction(shareUrl as ShareUrl));
    }

    public async setShareUrlById(shareId: string): Promise<ShareUrl> {
        const shareUrl = await this.getShareUrl(shareId);
        this.setShareUrl(shareUrl);
        return shareUrl;
    }

    public getSelectedShareUrl(): Immutable<ShareUrl> {
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).shareUrl;
    }

    public getFullUrlFromShareId(id: string) {
        const urlTree = this.router.createUrlTree([RouteStrings.SHARE, id]);
        return Urls.baseAddress + urlTree.toString();
    }

    public async getUserPermissions(): Promise<UserPermissions> {
        return await firstValueFrom(this.httpClient.get<UserPermissions>(Urls.permissions));
    }

    public getIconFromType(type: ShareUrl["type"]) {
        switch (type) {
            case "Hiking":
                return "icon-hike";
            case "Biking":
                return "icon-bike";
            case "4x4":
                return "icon-four-by-four";
            case "Unknown":
            default:
                return "icon-question";
        }
    }
}
