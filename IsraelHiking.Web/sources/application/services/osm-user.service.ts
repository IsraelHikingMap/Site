import { Injectable } from "@angular/core";
import { Http, Response } from "@angular/http";
import { Subject } from "rxjs/Subject";
import * as X2JS from "x2js";
import * as _ from "lodash";

import { AuthorizationService } from "./authorization.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";
import { Deferred } from "../common/deferred";

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

@Injectable()
export class OsmUserService {

    private oauth: OSMAuth.OSMAuthInstance;
    private x2Js: X2JS;
    private baseUrl: string;

    public tracesChanged: Subject<any>;
    public siteUrlsChanged: Subject<any>;
    public userLayersChanged: Subject<any>;
    public initializationFinished: Promise<any>;

    public displayName: string;
    public imageUrl: string;
    public changeSets: number;
    public traces: ITrace[];
    public siteUrls: Common.SiteUrl[];
    public baseLayers: Common.LayerData[];
    public overlays: Common.LayerData[];
    public userId: string;

    constructor(private http: Http,
        private authorizationService: AuthorizationService) {
        this.x2Js = new X2JS();
        this.traces = [];
        this.siteUrls = [];
        this.baseLayers = [];
        this.overlays = [];
        this.tracesChanged = new Subject();
        this.siteUrlsChanged = new Subject();
        this.userLayersChanged = new Subject();
        let deferred = new Deferred<any>();
        this.initializationFinished = deferred.promise;
        this.initialize(deferred);
    }

    private initialize(deferred: Deferred<any>): void {
        this.http.get(Urls.osmConfiguration).toPromise().then((response) => {
                let data = response.json();
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
                    deferred.resolve();
                }
                if (this.isLoggedIn()) {
                    this.getUserDetails(deferred);
                } else {
                    deferred.resolve();
                }
            }, () => {
                console.error("Unable to get OSM configuration");
                deferred.resolve();
            });
    }

    public logout = () => {
        this.oauth.logout();
        this.authorizationService.osmToken = null;
    }

    public isLoggedIn = (): boolean => {
        return this.oauth && this.oauth.authenticated() && this.authorizationService.osmToken != null;
    }

    public login = (): Promise<any> => {
        let deferred = new Deferred<any>();
        this.getUserDetails(deferred);
        return deferred.promise;
    }

    public getSiteUrlPostfix(id: string) {
        return `/#!/?s=${id}`;
    }

    public refreshDetails = (): Promise<any> => {
        let getTracesPromise = this.getTraces();
        let getSiteUtlsPromise = this.getSiteUrls();
        return Promise.all([getTracesPromise, getSiteUtlsPromise]);
    }

    private getUserDetails(deferred: Deferred<any>) {
        this.oauth.xhr({
            method: "GET",
            path: "/api/0.6/user/details"
        }, (detailsError: any, details: XMLDocument) => {
            if (detailsError) {
                deferred.reject(detailsError);
                return;
            }
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
            
            Promise.all([userLayersPromise, refreshDetailsPromise]).then(() => deferred.resolve(), () => deferred.reject());
        });
    }

    private getTraces = (): Promise<any> => {
        let promise = this.http.get(Urls.osmTrace, this.authorizationService.getHeader()).toPromise();
        promise.then((response) => {
            this.traces.splice(0);
            let files = [].concat(response.json() || []);
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
        return this.http.put(Urls.osmTrace + trace.id, trace, this.authorizationService.getHeader()).toPromise();
    }

    public deleteOsmTrace = (trace: ITrace): Promise<any> => {
        let promise = this.http.delete(Urls.osmTrace + trace.id, this.authorizationService.getHeader()).toPromise();
        promise.then(() => {
            _.remove(this.traces, traceToFind => traceToFind.id === trace.id);
            this.tracesChanged.next();
        });
        return promise;
    }

    private getSiteUrls = (): Promise<any> => {
        let promise = this.http.get(Urls.urls, this.authorizationService.getHeader()).toPromise();
        promise.then(response => {
            let siteUrls = response.json() as Common.SiteUrl[];
            this.siteUrls.splice(0);
            this.siteUrls.push(...siteUrls);
            this.siteUrlsChanged.next();
        }, () => {
             console.error("Unable to get user's shares.");
        });
        return promise;
    }
    
    public createSiteUrl = (siteUrl: Common.SiteUrl): Promise<Response> => {
        return this.http.post(Urls.urls, siteUrl, this.authorizationService.getHeader()).toPromise();
    }

    public updateSiteUrl = (siteUrl: Common.SiteUrl): Promise<{}> => {
        return this.http.put(Urls.urls + siteUrl.id, siteUrl, this.authorizationService.getHeader()).toPromise();
    }

    public deleteSiteUrl = (siteUrl: Common.SiteUrl): Promise<Response> => {
        let promise = this.http.delete(Urls.urls + siteUrl.id, this.authorizationService.getHeader()).toPromise();
        promise.then(() => {
            _.remove(this.siteUrls, s => s.id === siteUrl.id);
            this.siteUrlsChanged.next();
        });
        return promise;
    }

    public getImageFromSiteUrlId = (siteUrl: Common.SiteUrl) => {
        return Urls.images + siteUrl.id;
    }

    public getUrlFromSiteUrlId = (siteUrl: Common.SiteUrl) => {
        return Urls.baseAddress + this.getSiteUrlPostfix(siteUrl.id);
    }

    public getMissingParts(trace: ITrace): Promise<any> {
        return this.http.post(Urls.osm + "?url=" + trace.dataUrl, {}, this.authorizationService.getHeader()).toPromise();
    }

    public addAMissingPart(feature: GeoJSON.Feature<GeoJSON.LineString>): Promise<any> {
        return this.http.put(Urls.osm, feature, this.authorizationService.getHeader()).toPromise();
    }

    private getUserLayers = (): Promise<any> => {
        let promise = this.http.get(Urls.userLayers, this.authorizationService.getHeader()).toPromise();
        promise.then(response => {
            let data = response.json() as IUserLayers;
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
        }, (error) => {
            console.error(error);
        });
        return promise;
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
        
        return this.http.post(Urls.userLayers + this.userId, { layers: layers, } as IUserLayers, this.authorizationService.getHeader()).toPromise();
    }
    
    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, center: L.LatLng): string {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit#${background}&map=${zoom}/${center.lat}/${center.lng}`;
    }

    public getEditOsmGpxAddress(baseLayerAddress: string, gpxId: string) {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit?gpx=${gpxId}#${background}`;
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
