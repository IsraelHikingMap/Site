import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";
import { timeout } from "rxjs/operators";

import { HashService } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { SetShareUrlAction } from "../reducres/in-memory.reducer";
import { UpdateShareUrlAction, AddShareUrlAction, RemoveShareUrlAction } from "../reducres/share-urls.reducer";
import { ShareUrl, DataContainer, ApplicationState } from "../models/models";
import { SetShareUrlsLastModifiedDateAction } from "application/reducres/offline.reducer";
import { Urls } from "../urls";

interface IShareUrlSocialLinks {
    facebook: string;
    whatsapp: string;
    nakeb: string;
    ihm: string;
}

@Injectable()
export class ShareUrlsService {
    constructor(private readonly httpClient: HttpClient,
                private readonly whatsAppService: WhatsAppService,
                private readonly hashService: HashService,
                private readonly loggingService: LoggingService,
                private readonly databaseService: DatabaseService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
    }

    public async initialize() {
        if (this.ngRedux.getState().userState.userInfo == null) {
            return;
        }
        this.syncShareUrls();
    }

    public getShareUrlDisplayName(shareUrl: ShareUrl): string {
        return shareUrl.description ? `${shareUrl.title} - ${shareUrl.description}` : shareUrl.title;
    }

    public getShareSocialLinks(shareUrl: ShareUrl): IShareUrlSocialLinks {
        if (shareUrl == null) {
            return {
                ihm: "",
                facebook: "",
                whatsapp: "",
                nakeb: ""
            };
        }
        let ihm = this.hashService.getFullUrlFromShareId(shareUrl.id);
        let escaped = encodeURIComponent(ihm);
        return {
            ihm,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsAppService.getUrl(this.getShareUrlDisplayName(shareUrl), escaped) as string,
            nakeb: `https://www.nakeb.co.il/add_new_hike?ihm_link=${shareUrl.id}`
        };
    }

    private async getShareFromServerAndCacheIt(shareUrlId: string): Promise<ShareUrl> {
        this.loggingService.info(`[Shares] Getting share by id ${shareUrlId}`);
        let shareUrl = await this.httpClient.get(Urls.urls + shareUrlId).pipe(timeout(20000)).toPromise() as ShareUrl;
        this.databaseService.storeShareUrl(shareUrl);
        return shareUrl;
    }

    public async getShareUrl(shareUrlId: string): Promise<ShareUrl> {
        let shareUrl = await this.databaseService.getShareUrlById(shareUrlId);
        if (shareUrl == null) {
            return await this.getShareFromServerAndCacheIt(shareUrlId);
        }
        // Refresh it in the background if needed...
        this.httpClient.get(Urls.urls + shareUrlId + "/timestamp").pipe(timeout(2000)).toPromise().then((timestamp: string) => {
            if (new Date(timestamp) > new Date(shareUrl.lastModifiedDate)) {
                this.loggingService.warning(`[Shares] Cached share is outdated, fetching it again...`);
                this.getShareFromServerAndCacheIt(shareUrlId);
            }
        });
        return shareUrl;
    }

    public async syncShareUrls(): Promise<any> {
        try {
            let sharesLastSuccessfullSync = this.ngRedux.getState().offlineState.shareUrlsLastModifiedDate;
            let operationStartTimeStamp = new Date();
            this.loggingService.info(`[Shares] Starting shares sync, last modified: ${(sharesLastSuccessfullSync || new Date()).toUTCString()}`);
            let shareUrls = await this.httpClient.get(Urls.urls).pipe(timeout(10000)).toPromise() as ShareUrl[];
            let exitingShareUrls = this.ngRedux.getState().shareUrlsState.shareUrls;
            for (let shareUrl of shareUrls) {
                if (exitingShareUrls.find(s => s.id === shareUrl.id) != null) {
                    this.ngRedux.dispatch(new UpdateShareUrlAction({ shareUrl }));
                } else {
                    this.ngRedux.dispatch(new AddShareUrlAction({ shareUrl }));
                }
                if (sharesLastSuccessfullSync == null || new Date(shareUrl.lastModifiedDate) > sharesLastSuccessfullSync) {
                        await this.getShareFromServerAndCacheIt(shareUrl.id);
                }
            }
            for (let shareUrl of exitingShareUrls) {
                if (shareUrls.find(s => s.id === shareUrl.id) == null) {
                    this.ngRedux.dispatch(new RemoveShareUrlAction({ shareUrl }));
                    await this.databaseService.deleteShareUrlById(shareUrl.id);
                }
            }
            this.ngRedux.dispatch(new SetShareUrlsLastModifiedDateAction({lastModifiedDate: operationStartTimeStamp}));
            this.loggingService.info(`[Shares] Finished shares sync, last modified: ${operationStartTimeStamp.toUTCString()}`);
        } catch {
            this.loggingService.error("[Shares] Unable to sync shares");
        }
    }

    public async createShareUrl(shareUrl: ShareUrl): Promise<ShareUrl> {
        let createdShareUrl = await this.httpClient.post(Urls.urls, shareUrl).toPromise() as ShareUrl;
        this.ngRedux.dispatch(new AddShareUrlAction({ shareUrl: createdShareUrl }));
        return createdShareUrl;
    }

    public updateShareUrl(shareUrl: ShareUrl): Promise<ShareUrl> {
        return this.httpClient.put(Urls.urls + shareUrl.id, shareUrl).toPromise() as Promise<ShareUrl>;
    }

    public async deleteShareUrl(shareUrl: ShareUrl): Promise<void> {
        await this.httpClient.delete(Urls.urls + shareUrl.id).toPromise();
        this.ngRedux.dispatch(new RemoveShareUrlAction({ shareUrl }));
        await this.databaseService.deleteShareUrlById(shareUrl.id);
    }

    public getImageFromShareId = (shareUrl: ShareUrl, width?: number, height?: number) => {
        let address = Urls.images + shareUrl.id;
        if (width && height) {
            address += `?width=${width}&height=${height}`;
        }
        return address;
    }

    public async getImagePreview(dataContainer: DataContainer) {
        let image = await this.httpClient.post(Urls.images, dataContainer, { responseType: "blob" }).toPromise();
        return window.URL.createObjectURL(image);
    }

    public setShareUrl(shareUrl: ShareUrl) {
        this.ngRedux.dispatch(new SetShareUrlAction({
            shareUrl
        }));
    }

    public async setShareUrlById(shareId: string): Promise<ShareUrl> {
        let shareUrl = await this.getShareUrl(shareId);
        this.setShareUrl(shareUrl);
        return shareUrl;
    }

    public getSelectedShareUrl(): ShareUrl {
        return this.ngRedux.getState().inMemoryState.shareUrl;
    }
}
