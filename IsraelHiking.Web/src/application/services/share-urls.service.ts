import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { orderBy } from "lodash-es";
import { Store } from "@ngxs/store";
import { firstValueFrom } from "rxjs";
import type { Immutable } from "immer";

import { HashService } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { SetShareUrlAction } from "../reducers/in-memory.reducer";
import { UpdateShareUrlAction, RemoveShareUrlAction, AddShareUrlAction } from "../reducers/share-urls.reducer";
import { SetShareUrlsLastModifiedDateAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ShareUrl, DataContainer, ApplicationState } from "../models/models";

interface IShareUrlSocialLinks {
    facebook: string;
    whatsapp: string;
    nakeb: string;
    ihm: string;
}

@Injectable()
export class ShareUrlsService {
    private syncying: boolean;

    constructor(private readonly httpClient: HttpClient,
                private readonly whatsAppService: WhatsAppService,
                private readonly hashService: HashService,
                private readonly loggingService: LoggingService,
                private readonly databaseService: DatabaseService,
                private readonly store: Store) {
            this.syncying = false;
    }

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
                ihm: "",
                facebook: "",
                whatsapp: "",
                nakeb: ""
            };
        }
        const ihm = this.hashService.getFullUrlFromShareId(shareUrl.id);
        const escaped = encodeURIComponent(ihm);
        return {
            ihm,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsAppService.getUrl(this.getShareUrlDisplayName(shareUrl), escaped) as string,
            nakeb: `https://www.nakeb.co.il/add_new_hike?ihm_link=${shareUrl.id}`
        };
    }

    private async getShareFromServerAndCacheIt(shareUrlId: string): Promise<ShareUrl> {
        this.loggingService.info(`[Shares] Getting share by id ${shareUrlId}`);
        const shareUrl = await firstValueFrom(this.httpClient.get(Urls.urls + shareUrlId).pipe(timeout(60000)));
        this.databaseService.storeShareUrl(shareUrl as ShareUrl);
        return shareUrl as ShareUrl;
    }

    public async getShareUrl(shareUrlId: string): Promise<ShareUrl> {
        const shareUrl = await this.databaseService.getShareUrlById(shareUrlId);
        if (shareUrl == null) {
            return await this.getShareFromServerAndCacheIt(shareUrlId);
        }
        // Refresh it in the background if needed...

        firstValueFrom(this.httpClient.get(Urls.urls + shareUrlId + "/timestamp").pipe(timeout(2000))).then((timestamp: any) => {
            if (new Date(timestamp as string) > new Date(shareUrl.lastModifiedDate)) {
                this.loggingService.warning("[Shares] Cached share is outdated, fetching it again...");
                this.getShareFromServerAndCacheIt(shareUrlId);
            }
        });
        return shareUrl;
    }

    public async syncShareUrls(): Promise<any> {
        if (this.syncying) {
            this.loggingService.info("[Shares] Already syncing...");
            return;
        }
        this.syncying = true;
        try {
            const sharesLastSuccessfullSync = this.store.selectSnapshot((s: ApplicationState) => s.offlineState).shareUrlsLastModifiedDate;
            const operationStartTimeStamp = new Date();
            let sharesToGetFromServer = [] as ShareUrl[];
            this.loggingService.info("[Shares] Starting shares sync, last modified:" +
                (sharesLastSuccessfullSync || new Date(0)).toUTCString());
            const shareUrls$ = this.httpClient.get(Urls.urls).pipe(timeout(20000));
            const shareUrls = await firstValueFrom(shareUrls$) as ShareUrl[];
            this.loggingService.info("[Shares] Got the list of shares, statring to compare against exiting list");
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
            this.syncying = false;
        }
    }

    public async createShareUrl(shareUrl: ShareUrl): Promise<ShareUrl> {
        this.loggingService.info(`[Shares] Creating share with title: ${shareUrl.title}`);
        const createdShareUrl = await firstValueFrom(this.httpClient.post(Urls.urls, shareUrl)) as ShareUrl;
        createdShareUrl.lastModifiedDate = new Date(createdShareUrl.lastModifiedDate);
        this.store.dispatch(new AddShareUrlAction(createdShareUrl));
        return createdShareUrl;
    }

    public async updateShareUrl(shareUrl: ShareUrl): Promise<ShareUrl> {
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

    public getImageFromShareId(shareUrl: ShareUrl, width?: number, height?: number) {
        let address = Urls.images + shareUrl.id;
        if (width && height) {
            address += `?width=${width}&height=${height}`;
        }
        return address;
    }

    public async getImagePreview(dataContainer: DataContainer) {
        const image = await firstValueFrom(this.httpClient.post(Urls.images, dataContainer, { responseType: "blob" }));
        return window.URL.createObjectURL(image);
    }

    public setShareUrl(shareUrl: ShareUrl) {
        this.store.dispatch(new SetShareUrlAction(shareUrl));
    }

    public async setShareUrlById(shareId: string): Promise<ShareUrl> {
        const shareUrl = await this.getShareUrl(shareId);
        this.setShareUrl(shareUrl);
        return shareUrl;
    }

    public getSelectedShareUrl(): Immutable<ShareUrl> {
        return this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState).shareUrl;
    }
}
