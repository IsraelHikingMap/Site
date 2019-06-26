import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { remove } from "lodash";
import { NgRedux } from "@angular-redux/store";

import { HashService } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { Urls } from "../urls";
import { SetShareUrlAction } from "../reducres/in-memory.reducer";
import { ShareUrl, DataContainer, ApplicationState } from "../models/models";

interface IShareUrlSocialLinks {
    facebook: string;
    whatsapp: string;
    nakeb: string;
    ihm: string;
}

@Injectable()
export class ShareUrlsService {
    // HM TODO: move to state?
    public shareUrls: ShareUrl[];

    constructor(private readonly httpClient: HttpClient,
                private readonly whatsAppService: WhatsAppService,
                private readonly hashService: HashService,
                private readonly ngRedux: NgRedux<ApplicationState>) {

        this.shareUrls = [];
    }

    public getShareUrlDisplayName(shareUrl: ShareUrl): string {
        return this.getDisplayNameFromTitleAndDescription(shareUrl.title, shareUrl.description);
    }

    public getDisplayNameFromTitleAndDescription(title: string, description: string): string {
        return description ? `${title} - ${description}` : title;
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

    public getShareUrl = (shareUrlId: string): Promise<ShareUrl> => {
        return this.httpClient.get(Urls.urls + shareUrlId).toPromise() as Promise<ShareUrl>;
    }

    public getShareUrls = (): Promise<any> => {
        let promise = this.httpClient.get(Urls.urls).toPromise();
        promise.then((shareUrls: ShareUrl[]) => {
            this.shareUrls.splice(0);
            this.shareUrls.push(...shareUrls);
        }, () => {
            console.error("Unable to get user's shares.");
        });
        return promise;
    }

    public createShareUrl = (shareUrl: ShareUrl): Promise<ShareUrl> => {
        let promise = this.httpClient.post(Urls.urls, shareUrl).toPromise() as Promise<ShareUrl>;
        promise.then((createdShareUrl: ShareUrl) => {
            this.shareUrls.splice(0, 0, createdShareUrl);
        });
        return promise;
    }

    public updateShareUrl = (shareUrl: ShareUrl): Promise<ShareUrl> => {
        return this.httpClient.put(Urls.urls + shareUrl.id, shareUrl).toPromise() as Promise<ShareUrl>;
    }

    public deleteShareUrl = (shareUrl: ShareUrl): Promise<any> => {
        let promise = this.httpClient.delete(Urls.urls + shareUrl.id, { responseType: "text" }).toPromise() as Promise<any>;
        promise.then(() => {
            remove(this.shareUrls, s => s.id === shareUrl.id);
        });
        return promise;
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
