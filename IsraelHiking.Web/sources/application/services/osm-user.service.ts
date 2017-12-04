import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Subject } from "rxjs/Subject";
import * as X2JS from "x2js";
import * as _ from "lodash";

import { AuthorizationService } from "./authorization.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export type Visibility = "private" | "public";

export interface ITrace {
    name: string;
    description: string;
    url: string;
    imageUrl: string;
    dataUrl: string;
    id: string;
    date: Date;
    tags: string[];
    tagsString: string;
    visibility: Visibility;
    isInEditMode: boolean;
}

interface IUserLayer extends Common.LayerData {
    isOverlay: boolean;
}

interface IUserLayers {
    layers: IUserLayer[];
}

interface IOsmConfiguration {
    baseAddress: string;
    consumerKey: string;
    consumerSecret: string;
}

@Injectable()
export class OsmUserService {

    private oauth: OSMAuth.OSMAuthInstance;
    private x2Js: X2JS;
    private baseUrl: string;

    public tracesChanged: Subject<any>;
    public shareUrlsChanged: Subject<any>;
    public userLayersChanged: Subject<any>;

    public displayName: string;
    public imageUrl: string;
    public changeSets: number;
    public traces: ITrace[];
    public shareUrls: Common.ShareUrl[];
    public baseLayers: Common.LayerData[];
    public overlays: Common.LayerData[];
    public userId: string;

    constructor(private httpClient: HttpClient,
        private authorizationService: AuthorizationService) {
        this.x2Js = new X2JS();
        this.traces = [];
        this.shareUrls = [];
        this.baseLayers = [];
        this.overlays = [];
        this.tracesChanged = new Subject();
        this.shareUrlsChanged = new Subject();
        this.userLayersChanged = new Subject();
    }

    public async initialize() {
        try {
            let data = await this.httpClient.get(Urls.osmConfiguration).toPromise() as IOsmConfiguration;
            this.baseUrl = data.baseAddress;
            this.oauth = this.authorizationService.createOSMAuth({
                oauth_consumer_key: data.consumerKey,
                oauth_secret: data.consumerSecret,
                auto: true, // show a login form if the user is not authenticated and you try to do a call
                landing: "oauth-close-window.html",
                url: this.baseUrl
            } as OSMAuth.OSMAuthOptions);
            if (this.authorizationService.osmToken == null) {
                this.oauth.logout();
            }
            else if (this.isLoggedIn()) {
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
    }

    public isLoggedIn = (): boolean => {
        return this.oauth && this.oauth.authenticated() && this.authorizationService.osmToken != null;
    }

    public login = (): Promise<any> => {
        return this.getUserDetails();
    }

    public getShareUrlPostfix(id: string) {
        return `/#!/?s=${id}`;
    }

    public getShareUrlDisplayName(shareUrl: Common.ShareUrl): string {
        return this.getDisplayNameFromTitleAndDescription(shareUrl.title, shareUrl.description);
    }

    public getDisplayNameFromTitleAndDescription(title: string, description: string): string {
        return description ? `${title} - ${description}` : title;
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

        let refreshDetailsPromise = this.refreshDetails();
        let userLayersPromise = this.getUserLayers();
        await Promise.all([userLayersPromise, refreshDetailsPromise]);
    }

    private getTraces = (): Promise<any> => {
        let promise = this.httpClient.get(Urls.osmTrace).toPromise();
        promise.then((response: any[]) => {
            this.traces.splice(0);
            let files = [].concat(response || []);
            for (let traceJson of files) {
                let url = `${this.baseUrl}/user/${traceJson.userName}/traces/${traceJson.id}`;
                let dataUrl = `${this.baseUrl}/api/0.6/gpx/${traceJson.id}/data`;
                traceJson.url = url;
                traceJson.tagsString = traceJson.tags && traceJson.tags.length > 0 ? traceJson.tags.join(", ") : "";
                traceJson.imageUrl = url + "/picture";
                traceJson.dataUrl = dataUrl;
                traceJson.date = new Date(traceJson.date);
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
        return this.httpClient.put(Urls.osmTrace + trace.id, trace).toPromise();
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
        return Urls.baseAddress + this.getShareUrlPostfix(shareUrl.id);
    }

    public getMissingParts(trace: ITrace): Promise<any> {
        return this.httpClient.post(Urls.osm + "?url=" + trace.dataUrl, {}).toPromise();
    }

    public addAMissingPart(feature: GeoJSON.Feature<GeoJSON.LineString>): Promise<any> {
        return this.httpClient.put(Urls.osm, feature).toPromise();
    }

    private getUserLayers = async (): Promise<any> => {
        try {
            let data = await this.httpClient.get(Urls.userLayers).toPromise() as IUserLayers;
            this.baseLayers.splice(0);
            this.overlays.splice(0);
            if (data == null || data.layers == null) {
                this.userLayersChanged.next();
                return;
            }
            for (let layer of data.layers) {
                if (layer.isOverlay) {
                    this.overlays.push(layer);
                } else {
                    this.baseLayers.push(layer);
                }
            }
            this.userLayersChanged.next();
        } catch (error) {
            console.error(error);
        }
    }

    public updateUserLayers = (baseLayersToStore: Common.LayerData[], overlaysToStore: Common.LayerData[]): Promise<any> => {
        if (!this.isLoggedIn()) {
            return Promise.resolve();
        }

        let layers = [...baseLayersToStore];
        for (let overlayToStore of overlaysToStore) {
            (overlayToStore as IUserLayer).isOverlay = true;
            layers.push(overlayToStore);
        }

        return this.httpClient.post(Urls.userLayers + this.userId, { layers: layers, } as IUserLayers).toPromise();
    }

    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, center: L.LatLng): string {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit#${background}&map=${zoom}/${center.lat}/${center.lng}`;
    }

    public getEditOsmGpxAddress(baseLayerAddress: string, gpxId: string) {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit?gpx=${gpxId}#${background}`;
    }

    public getEditElementOsmAddress(baseLayerAddress: string, elementType: string, id: string) {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit?${elementType}=${id}#${background}`;
    }

    private getBackgroundStringForOsmAddress(baseLayerAddress: string): string {
        let background = "background=bing";
        if (baseLayerAddress !== "") {
            if (baseLayerAddress.indexOf("/") === 0) {
                baseLayerAddress = Urls.baseAddress + baseLayerAddress;
            }
            let address = baseLayerAddress.replace("{s}", "s");
            background = `background=custom:${address}`;
        }
        return background;
    }


}
