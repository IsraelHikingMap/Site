import { Injectable } from "@angular/core";
import { Http, Response, RequestOptionsArgs, Headers } from "@angular/http";
import { LocalStorage, SessionStorage } from "angular2-localstorage";
import { AuthorizationService } from "./AuthorizationService";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";
import * as X2JS from "x2js";
import * as _ from "lodash";
var osmAuth = require('osm-auth') as Function;

//declare var osmAuth: Function;

interface IOsmAuthService {
    authenticated(): boolean;
    xhr(options: Object, callback: Function): void;
    logout(): void;
}

export interface ITrace {
    fileName: string;
    description: string;
    url: string;
    imageUrl: string;
    dataUrl: string;
    id: string;
    date: Date;
}

@Injectable()
export class OsmUserService {
    private oauth: any;
    private x2Js: X2JS;
    private baseUrl: string;

    public displayName: string;
    public imageUrl: string;
    public changeSets: number;
    public traces: ITrace[];
    public siteUrls: Common.SiteUrl[];
    public userId: string;
    public loading: boolean;

    constructor(private http: Http,
        private authorizationService: AuthorizationService) {
        this.loading = false;

        this.http.get(Urls.osmConfiguration).toPromise().then((response) => {
            let data = response.json();
            this.baseUrl = data.baseAddress;
            this.oauth = osmAuth({
                oauth_consumer_key: data.consumerKey,
                oauth_secret: data.consumerSecret,
                auto: true, // show a login form if the user is not authenticated and you try to do a call
                landing: "application/components/oauth-close-window.html",
                url: this.baseUrl
            }) as IOsmAuthService;
            if (this.authorizationService.token == null) {
                this.oauth.logout();
            }
            if (this.isLoggedIn()) {
                this.refreshDetails();
            }
        }, () => { console.error("Unable to get OSM configuration") });

        this.x2Js = new X2JS();
        this.traces = [];
        this.siteUrls = [];
    }

    public logout = () => {
        this.oauth.logout();
        this.authorizationService.token = null;
    }

    public isLoggedIn = (): boolean => {
        return this.oauth && this.oauth.authenticated() && this.authorizationService.token != null;
    }

    public login = (): Promise<{}> => {
        return this.refreshDetails();
    }

    public getSiteUrlPostfix(id: string) {
        return `/#!/?s=${id}`;
    }

    public refreshDetails = (): Promise<{}> => {
        this.loading = true;
        var sharesPromise = Promise.resolve<Response>(null);
        let promise = new Promise((resolve, reject) => {
            this.oauth.xhr({
                method: "GET",
                path: "/api/0.6/user/details"
            }, (detailsError: any, details: XMLDocument) => {
                if (detailsError) {
                    this.loading = false;
                    reject(detailsError);
                    return;
                }
                let authToken = localStorage.getItem(`${this.baseUrl}oauth_token`); // using native storage since it is saved with ohauth
                let authTokenSecret = localStorage.getItem(`${this.baseUrl}oauth_token_secret`);
                this.authorizationService.token = authToken + ";" + authTokenSecret;
                let detailJson = this.x2Js.xml2js(details.documentElement.outerHTML) as any;
                this.displayName = detailJson.osm.user._display_name;
                if (detailJson.osm.user.img && detailJson.osm.user.img._href) {
                    this.imageUrl = detailJson.osm.user.img._href;
                }
                this.changeSets = detailJson.osm.user.changesets._count;
                this.userId = detailJson.osm.user._id;
                this.oauth.xhr({
                    method: "GET",
                    path: "/api/0.6/user/gpx_files"
                }, (tracesError: any, traces: XMLDocument) => {
                    if (tracesError) {
                        reject(tracesError);
                        return;
                    }
                    let tracesJson = this.x2Js.xml2js(traces.documentElement.outerHTML) as any;
                    this.traces.splice(0);
                    let files = [].concat(tracesJson.osm.gpx_file || []);
                    for (let traceJson of files) {
                        let id = traceJson._id;
                        let url = `${this.baseUrl}/user/${traceJson._user}/traces/${id}`;
                        let dataUrl = `${this.baseUrl}/api/0.6/gpx/${id}/data`;
                        this.traces.push({
                            fileName: traceJson._name,
                            description: traceJson.description,
                            url: url,
                            imageUrl: url + "/picture",
                            dataUrl: dataUrl,
                            id: id,
                            date: new Date(traceJson._timestamp)
                        });
                    }
                    resolve();
                    });
                sharesPromise = this.http.get(Urls.urls, this.authorizationService.getHeader()).toPromise();
                sharesPromise.then((response) => {
                    this.siteUrls.splice(0);
                    this.siteUrls.push(...response.json() as Common.SiteUrl[]);
                }, () => { console.error("Unable to get user shares.") });
            });
        });
        let allPromises = Promise.all([promise, sharesPromise]);
        allPromises.then(() => { this.loading = false }, () => {
            console.log("OSM User refresh details failed.");
            this.loading = false
        });
        return allPromises;
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
