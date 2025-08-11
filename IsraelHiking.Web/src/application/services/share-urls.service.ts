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
import { UpdateShareUrlAction, RemoveShareUrlAction, AddShareUrlAction } from "../reducers/share-urls.reducer";
import { SetShareUrlsLastModifiedDateAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ShareUrl, ApplicationState } from "../models/models";

interface IShareUrlSocialLinks {
    facebook: string;
    whatsapp: string;
    nakeb: string;
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
                nakeb: ""
            };
        }
        const app = this.getFullUrlFromShareId(shareUrl.id);
        const escaped = encodeURIComponent(app);
        return {
            app: app,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsAppService.getUrl(this.getShareUrlDisplayName(shareUrl), escaped) as string,
            nakeb: `https://www.nakeb.co.il/add_new_hike?ihm_link=${shareUrl.id}`
        };
    }

    private async getShareFromServerAndCacheIt(shareUrlId: string, timeToWait = 60000): Promise<ShareUrl> {
        this.loggingService.info(`[Shares] Getting share by id ${shareUrlId}`);
        const shareUrl = await firstValueFrom(this.httpClient.get(Urls.urls + shareUrlId).pipe(timeout(timeToWait)));
        this.databaseService.storeShareUrl(shareUrl as ShareUrl);
        return shareUrl as ShareUrl;
    }

    public async getShareUrl(shareUrlId: string): Promise<ShareUrl> {
        let shareUrl = await this.databaseService.getShareUrlById(shareUrlId);
        if (shareUrl == null) {
            return await this.getShareFromServerAndCacheIt(shareUrlId);
        }
        // Refresh it in the background if needed...
        try {
            const timestamp = await firstValueFrom(this.httpClient.get(Urls.urls + shareUrlId + "/timestamp").pipe(timeout(2000)));
            if (new Date(timestamp as string) < new Date(shareUrl.lastModifiedDate)) {
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
            const sharesLastSuccessfullSync = this.store.selectSnapshot((s: ApplicationState) => s.offlineState).shareUrlsLastModifiedDate;
            const operationStartTimeStamp = new Date();
            let sharesToGetFromServer = [] as ShareUrl[];
            this.loggingService.info("[Shares] Starting shares sync, last modified: " +
                (sharesLastSuccessfullSync || new Date(0)).toUTCString());
            const shareUrls$ = this.httpClient.get(Urls.urls).pipe(timeout(20000));
            const shareUrls = await firstValueFrom(shareUrls$) as ShareUrl[];
            this.loggingService.info("[Shares] Got the list of shares, starting to compare against exiting list");
            const exitingShareUrls = this.store.selectSnapshot((s: ApplicationState) => s.shareUrlsState).shareUrls;
            for (const shareUrl of shareUrls) {
                shareUrl.lastModifiedDate = new Date(shareUrl.lastModifiedDate);
                if (exitingShareUrls.find(s => s.id === shareUrl.id) != null) {
                    this.store.dispatch(new UpdateShareUrlAction(shareUrl));
                } else {
                    this.store.dispatch(new AddShareUrlAction(shareUrl));
                }
                if (sharesLastSuccessfullSync == null || shareUrl.lastModifiedDate > sharesLastSuccessfullSync) {
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
                this.store.dispatch(new SetShareUrlsLastModifiedDateAction(shareToGet.lastModifiedDate));
            }
            this.store.dispatch(new SetShareUrlsLastModifiedDateAction(operationStartTimeStamp));
            this.loggingService.info(`[Shares] Finished shares sync, last modified: ${operationStartTimeStamp.toUTCString()}`);
        } catch (ex) {
            this.loggingService.error("[Shares] Unable to sync shares: " + (ex as Error).message);
        } finally {
            this.syncing = false;
        }
    }

    public async createShareUrl(shareUrl: ShareUrl): Promise<Immutable<ShareUrl>> {
        this.loggingService.info(`[Shares] Creating share with title: ${shareUrl.title}`);
        const createdShareUrl = await firstValueFrom(this.httpClient.post(Urls.urls, shareUrl)) as ShareUrl;
        createdShareUrl.lastModifiedDate = new Date(createdShareUrl.lastModifiedDate);
        this.store.dispatch(new AddShareUrlAction(createdShareUrl));
        return createdShareUrl;
    }

    public async updateShareUrl(shareUrl: ShareUrl): Promise<Immutable<ShareUrl>> {
        this.loggingService.info(`[Shares] Updating share with id: ${shareUrl.id}`);
        const updatedShareUrl = await firstValueFrom(this.httpClient.put(Urls.urls + shareUrl.id, shareUrl)) as ShareUrl;
        updatedShareUrl.lastModifiedDate = new Date(updatedShareUrl.lastModifiedDate);
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
}
