import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subject } from "rxjs";
import * as _ from "lodash";

import { AuthorizationService, IAuthorizationServiceOptions } from "./authorization.service";
import { HashService } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export type Visibility = "private" | "public";

export interface ITrace {
    name: string;
    user: string;
    description: string;
    url: string;
    imageUrl: string;
    dataUrl: string;
    id: string;
    timeStamp: Date;
    tags: string[];
    tagsString: string;
    visibility: Visibility;
    isInEditMode: boolean;
}

interface IOsmConfiguration {
    baseAddress: string;
    consumerKey: string;
    consumerSecret: string;
}

interface IShareUrlSocialLinks {
    facebook: string;
    whatsapp: string;
    nakeb: string;
    ihm: string;
}

@Injectable()
export class OsmUserService {
    private baseUrl: string;

    public tracesChanged: Subject<any>;
    public shareUrlsChanged: Subject<any>;
    public loginStatusChanged: EventEmitter<any>;

    public displayName: string;
    public imageUrl: string;
    public changeSets: number;
    public traces: ITrace[];
    public shareUrls: Common.ShareUrl[];
    public userId: string;

    constructor(private readonly httpClient: HttpClient,
        private readonly authorizationService: AuthorizationService,
        private readonly whatsAppService: WhatsAppService,
        private readonly hashService: HashService) {
        this.traces = [];
        this.shareUrls = [];
        this.tracesChanged = new Subject();
        this.shareUrlsChanged = new Subject();
        this.loginStatusChanged = new EventEmitter();
    }

    public async initialize() {
        try {
            let data = await this.httpClient.get(Urls.osmConfiguration).toPromise() as IOsmConfiguration;
            this.baseUrl = data.baseAddress;
            this.authorizationService.setOptions({
                oauthConsumerKey: data.consumerKey,
                oauthSecret: data.consumerSecret,
                landing: Urls.emptyHtml,
                url: this.baseUrl
            } as IAuthorizationServiceOptions);
            if (this.isLoggedIn()) {
                await this.getUserDetails();
            }
        } catch (ex) {
            console.error(`Unable to get OSM configuration: ${JSON.stringify(ex)}`);
        }
    }

    public logout = () => {
        this.authorizationService.logout();
        this.loginStatusChanged.next();
    }

    public isLoggedIn = (): boolean => {
        return this.authorizationService.authenticated();
    }

    public login = async () => {
        await this.authorizationService.authenticate();
        await this.getUserDetails();
        this.loginStatusChanged.next();
    }

    public getShareUrlDisplayName(shareUrl: Common.ShareUrl): string {
        return this.getDisplayNameFromTitleAndDescription(shareUrl.title, shareUrl.description);
    }

    public getDisplayNameFromTitleAndDescription(title: string, description: string): string {
        return description ? `${title} - ${description}` : title;
    }

    public getShareSocialLinks(shareUrl: Common.ShareUrl): IShareUrlSocialLinks {
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
            ihm: ihm,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsAppService.getUrl(this.getShareUrlDisplayName(shareUrl), escaped) as string,
            nakeb: `https://www.nakeb.co.il/add_new_hike?ihm_link=${shareUrl.id}`
        };
    }

    public refreshDetails = (): Promise<any> => {
        let getTracesPromise = this.getTraces();
        let getSiteUtlsPromise = this.getShareUrls();
        return Promise.all([getTracesPromise, getSiteUtlsPromise]);
    }

    private getUserDetails = async () => {
        let detailJson = await this.httpClient.get(Urls.osmUser).toPromise() as any;
        this.displayName = detailJson.displayName;
        this.userId = detailJson.id;
        this.changeSets = detailJson.changeSetCount;
        if (detailJson.image) {
            this.imageUrl = detailJson.image;
        }
        await this.refreshDetails();
    }

    private getTraces = async (): Promise<any> => {
        try {
            let response = await this.httpClient.get(Urls.osmTrace).toPromise() as ITrace[];
            this.traces.splice(0);
            let files = ([] as ITrace[]).concat(response || []);
            for (let traceJson of files) {
                let url = `${this.baseUrl}/user/${traceJson.user}/traces/${traceJson.id}`;
                let dataUrl = `${this.baseUrl}/api/0.6/gpx/${traceJson.id}/data`;
                traceJson.url = url;
                traceJson.tagsString = traceJson.tags && traceJson.tags.length > 0 ? traceJson.tags.join(", ") : "";
                traceJson.imageUrl = url + "/picture";
                traceJson.dataUrl = dataUrl;
                traceJson.timeStamp = new Date(traceJson.timeStamp);
                traceJson.isInEditMode = false;
                this.traces.push(traceJson);
            }
            this.tracesChanged.next();
        } catch (ex) {
            console.error("Unable to get user's traces.");
        }
    }

    public updateOsmTrace = (trace: ITrace): Promise<any> => {
        trace.tags = trace.tagsString.split(",").map(t => t.trim()).filter(t => t);
        return this.httpClient.put(Urls.osmTrace + trace.id, trace, { responseType: "text" }).toPromise();
    }

    public deleteOsmTrace = (trace: ITrace): Promise<any> => {
        let promise = this.httpClient.delete(Urls.osmTrace + trace.id, { responseType: "text" }).toPromise();
        promise.then(() => {
            _.remove(this.traces, traceToFind => traceToFind.id === trace.id);
            this.tracesChanged.next();
        });
        return promise;
    }

    public getShareUrl = (shareUrlId: string): Promise<Common.ShareUrl> => {
        return this.httpClient.get(Urls.urls + shareUrlId).toPromise() as Promise<Common.ShareUrl>;
    }

    private getShareUrls = (): Promise<any> => {
        let promise = this.httpClient.get(Urls.urls).toPromise();
        promise.then((shareUrls: Common.ShareUrl[]) => {
            this.shareUrls.splice(0);
            this.shareUrls.push(...shareUrls);
            this.shareUrlsChanged.next();
        }, () => {
            console.error("Unable to get user's shares.");
        });
        return promise;
    }

    public createShareUrl = (shareUrl: Common.ShareUrl): Promise<Common.ShareUrl> => {
        let promise = this.httpClient.post(Urls.urls, shareUrl).toPromise() as Promise<Common.ShareUrl>;
        promise.then((createdShareUrl: Common.ShareUrl) => {
            this.shareUrls.splice(0, 0, createdShareUrl);
            this.shareUrlsChanged.next();
        });
        return promise;
    }

    public updateShareUrl = (shareUrl: Common.ShareUrl): Promise<Common.ShareUrl> => {
        return this.httpClient.put(Urls.urls + shareUrl.id, shareUrl).toPromise() as Promise<Common.ShareUrl>;
    }

    public deleteShareUrl = (shareUrl: Common.ShareUrl): Promise<any> => {
        let promise = this.httpClient.delete(Urls.urls + shareUrl.id, { responseType: "text" }).toPromise() as Promise<any>;
        promise.then(() => {
            _.remove(this.shareUrls, s => s.id === shareUrl.id);
            this.shareUrlsChanged.next();
        });
        return promise;
    }

    public getImageFromShareId = (shareUrl: Common.ShareUrl, width?: number, height?: number) => {
        let address = Urls.images + shareUrl.id;
        if (width && height) {
            address += `?width=${width}&height=${height}`;
        }
        return address;
    }

    public getMissingParts(trace: ITrace): Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>> {
        return this.httpClient.post(Urls.osm + "?url=" + trace.dataUrl, {})
            .toPromise() as Promise<GeoJSON.FeatureCollection<GeoJSON.LineString>>;
    }

    public addAMissingPart(feature: GeoJSON.Feature<GeoJSON.LineString>): Promise<any> {
        return this.httpClient.put(Urls.osm, feature, { responseType: "text" }).toPromise();
    }

    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, center: L.LatLng): string {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit#${background}&map=${zoom}/${center.lat}/${center.lng}`;
    }

    public getEditOsmGpxAddress(baseLayerAddress: string, gpxId: string) {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit?gpx=${gpxId}#${background}`;
    }

    public getEditElementOsmAddress(baseLayerAddress: string, id: string) {
        let elementType = id.split("_")[0];
        let elementId = id.split("_")[1];
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit?${elementType}=${elementId}#${background}`;
    }

    public getElementOsmAddress(id: string) {
        let elementType = id.split("_")[0];
        let elementId = id.split("_")[1];
        return `${this.baseUrl}/${elementType}/${elementId}`;
    }

    private getBackgroundStringForOsmAddress(baseLayerAddress: string): string {
        let background = "background=bing";
        if (baseLayerAddress !== "") {
            if (baseLayerAddress.startsWith("/")) {
                baseLayerAddress = Urls.baseTilesAddress + baseLayerAddress;
            }
            let address = baseLayerAddress.replace("{s}", "s");
            background = `background=custom:${address}`;
        }
        return background;
    }

    public async getImagePreview(dataContainer: Common.DataContainer) {
        let image = await this.httpClient.post(Urls.images, dataContainer, { responseType: "blob" }).toPromise();
        return window.URL.createObjectURL(image);
    }
}
