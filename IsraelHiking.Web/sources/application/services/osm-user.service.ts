import { Injectable, EventEmitter } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subject } from "rxjs";
import * as X2JS from "x2js";
import * as _ from "lodash";

import { AuthorizationService } from "./authorization.service";
import { HashService } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
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

    private oauth: OSMAuth.OSMAuthInstance;
    private x2Js: X2JS;
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
        private readonly hashService: HashService,
        private readonly nonAngularObjectsFactory: NonAngularObjectsFactory) {
        this.x2Js = new X2JS();
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
            this.oauth = this.nonAngularObjectsFactory.createOsmAuth({
                oauth_consumer_key: data.consumerKey,
                oauth_secret: data.consumerSecret,
                auto: true, // show a login form if the user is not authenticated and you try to do a call
                landing: Urls.baseAddress + "/oauth-close-window.html",
                url: this.baseUrl
            } as OSMAuth.OSMAuthOptions);
            if (this.authorizationService.osmToken == null) {
                this.oauth.logout();
            } else if (this.isLoggedIn()) {
                await this.getUserDetails();
            }
        } catch (ex) {
            console.error(`Unable to get OSM configuration: ${JSON.stringify(ex)}`);
        }
    }

    public logout = () => {
        if (this.oauth != null) {
            this.oauth.logout();
        }
        this.authorizationService.osmToken = null;
        this.loginStatusChanged.next();
    }

    public isLoggedIn = (): boolean => {
        return this.oauth && this.oauth.authenticated() && this.authorizationService.osmToken != null;
    }

    public login = async () => {
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
        let ihm = this.getUrlFromShareId(shareUrl);
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

    private async getUserDetails() {
        let details = await new Promise<XMLDocument>((resolve, reject) => {
            this.oauth.xhr({
                method: "GET",
                path: "/api/0.6/user/details"
            },
                (detailsError: any, detailsResponse: XMLDocument) => {
                    if (detailsError) {
                        reject(detailsError);
                    }
                    resolve(detailsResponse);
                });
        });
        let authToken = localStorage.getItem(`${this.baseUrl}oauth_token`); // using native storage since it is saved with ohauth
        let authTokenSecret = localStorage.getItem(`${this.baseUrl}oauth_token_secret`);
        this.authorizationService.osmToken = authToken + ";" + authTokenSecret;
        let detailJson = this.x2Js.xml2js(details.documentElement.outerHTML) as any;
        this.displayName = detailJson.osm.user._display_name;
        if (detailJson.osm.user.img && detailJson.osm.user.img._href) {
            this.imageUrl = detailJson.osm.user.img._href;
        }
        this.changeSets = detailJson.osm.user.changesets._count;
        this.userId = detailJson.osm.user._id;

        await this.refreshDetails();
    }

    private getTraces = (): Promise<any> => {
        let promise = this.httpClient.get(Urls.osmTrace).toPromise();
        promise.then((response: ITrace[]) => {
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
        }, () => {
            console.error("Unable to get user's traces.");
        });
        return promise;
    }

    public updateOsmTrace = (trace: ITrace): Promise<any> => {
        trace.tags = trace.tagsString.split(",").map(t => t.trim());
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

    public getImageFromShareId = (shareUrl: Common.ShareUrl) => {
        return Urls.images + shareUrl.id;
    }

    public getUrlFromShareId = (shareUrl: Common.ShareUrl) => {
        return this.hashService.getFullUrlFromShareId(shareUrl.id);
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

    private getBackgroundStringForOsmAddress(baseLayerAddress: string): string {
        let background = "background=bing";
        if (baseLayerAddress !== "") {
            if (baseLayerAddress.startsWith("/")) {
                baseLayerAddress = Urls.baseAddress + baseLayerAddress;
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
