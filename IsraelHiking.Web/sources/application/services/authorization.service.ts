import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { ApplicationState, OsmUserDetails, UserState, UserInfo } from "../models/models";
import { Urls } from "../urls";
import { SetTokenAction, SetUserInfoAction } from "../reducres/user.reducer";
import { RunningContextService } from "./running-context.service";

interface IOAuthParams {
    oauth_consumer_key: string;
    oauth_signature_method: string;
    oauth_timestamp: number;
    oauth_nonce: string;
    oauth_token: string;
    oauth_signature: string;
}

export interface IAuthorizationServiceOptions {
    url: string;
    oauthSecret: string;
    landing: string;
    oauthConsumerKey: string;
}

interface IOsmConfiguration {
    baseAddress: string;
    consumerKey: string;
    consumerSecret: string;
}

@Injectable()
export class AuthorizationService {

    private baseUrl: string;

    private options: IAuthorizationServiceOptions;
    private oauthRequestTokenSecret: string;
    private authorizeUrl: string;
    private ohauth: any;

    @select((state: ApplicationState) => state.userState)
    private userState$: Observable<UserState>;

    private userState: UserState;

    constructor(private readonly httpClient: HttpClient,
        private readonly runningContextService: RunningContextService,
        private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        this.ohauth = this.nonAngularObjectsFactory.createOhAuth();
        this.oauthRequestTokenSecret = "";
        this.setOptions({});

        this.userState$.subscribe(us => this.userState = us);

        this.httpClient.get(Urls.osmConfiguration).toPromise().then((data: IOsmConfiguration) => {
            this.baseUrl = data.baseAddress;
            this.setOptions({
                oauthConsumerKey: data.consumerKey,
                oauthSecret: data.consumerSecret,
                landing: Urls.emptyHtml,
                url: data.baseAddress
            } as IAuthorizationServiceOptions);
        });
    }

    public isLoggedIn(): boolean {
        return this.userState.userInfo != null;
    }

    public getUserInfo(): UserInfo {
        return this.userState.userInfo;
    }

    public getToken(): string {
        return this.userState.token;
    }

    public logout() {
        this.ngRedux.dispatch(new SetTokenAction({ token: null }));
        this.ngRedux.dispatch(new SetUserInfoAction({ userInfo: null }));
    }

    public login = async (): Promise<any> => {
        if (this.isLoggedIn()) {
            return new Promise((resolve) => { resolve(); });
        }

        this.logout();
        try {
            let url = this.runningContextService.isCordova
                ? await this.openCordovaDialog()
                : await this.openBrowserDialog();
            let oauthToken = this.ohauth.stringQs(url.split("?")[1]);
            await this.updateAccessToken(oauthToken.oauth_token);
            await this.updateUserDetails();
        } finally {
            this.refreshAuthorizeUrl();
        }
    }

    private updateUserDetails = async () => {
        let detailJson = await this.httpClient.get(Urls.osmUser).toPromise() as OsmUserDetails;
        let userInfo = {
            displayName: detailJson.displayName,
            id: detailJson.id,
            changeSets: detailJson.changeSetCount,
            imageUrl: detailJson.image
        };
        this.ngRedux.dispatch(new SetUserInfoAction({
            userInfo: userInfo
        }));
    }

    private updateAccessToken = async (oauthToken) => {
        let accessTokenUrl = this.options.url + "/oauth/access_token";
        let params = this.getParams();
        params.oauth_token = oauthToken;
        params.oauth_signature = this.ohauth.signature(
            this.options.oauthSecret,
            this.oauthRequestTokenSecret,
            this.ohauth.baseString("POST", accessTokenUrl, params));

        let response = await this.xhrPromise(accessTokenUrl, params);
        let accessToken = this.ohauth.stringQs(response);
        let token = accessToken.oauth_token + ";" + accessToken.oauth_token_secret;
        this.ngRedux.dispatch(new SetTokenAction({
            token: token
        }));
    }

    public async setOptions(options) {
        this.options = options;
        this.options.url = this.options.url || "https://www.openstreetmap.org";
        this.options.landing = this.options.landing || "land.html";

        if (!this.options.oauthConsumerKey) {
            return;
        }
        this.refreshAuthorizeUrl();
    }

    private refreshAuthorizeUrl = async () => {
        let params = this.getParams();
        let requestTokenUrl = this.options.url + "/oauth/request_token";

        params.oauth_signature = this.ohauth.signature(
            this.options.oauthSecret, "",
            this.ohauth.baseString("POST", requestTokenUrl, params));

        let response = await this.xhrPromise(requestTokenUrl, params);
        let responseObject = this.ohauth.stringQs(response);
        this.oauthRequestTokenSecret = responseObject.oauth_token_secret;
        this.authorizeUrl = this.options.url + "/oauth/authorize?" + this.ohauth.qsString({
            oauth_token: responseObject.oauth_token,
            oauth_callback: this.options.landing
        });
    }

    private getParams(): IOAuthParams {
        return {
            oauth_consumer_key: this.options.oauthConsumerKey,
            oauth_signature_method: "HMAC-SHA1",
            oauth_timestamp: this.ohauth.timestamp(),
            oauth_nonce: this.ohauth.nonce()
        } as IOAuthParams;
    }

    private xhrPromise(url, params): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            this.ohauth.xhr("POST", url, params, null, {},
                (err, xhr) => {
                    if (err) {
                        reject(err);
                    }
                    resolve(xhr.response);
                });
        });
    }

    private openBrowserDialog(): Promise<any> {
        // Create a 600x550 popup window in the center of the screen
        let w = 600;
        let h = 550;
        let settings = [
            ["width", w], ["height", h],
            ["left", screen.width / 2 - w / 2],
            ["top", screen.height / 2 - h / 2]
        ].map((x) => {
            return x.join("=");
        }).join(",");

        let popup = window.open(this.authorizeUrl, "Authorization", settings);

        return new Promise((resolve, reject) => {
            if (typeof popup.focus === "function") {
                popup.focus();
            }

            setTimeout(() => this.watchPopup(popup, resolve, reject), 100);
        });
    }

    private async watchPopup(popup, resolve: Function, reject: Function) {
        try {
            if (popup.closed) {
                reject(new Error(`The OSM sign in flow was canceled`));
                return;
            }
            if (popup.location.href.indexOf(this.options.landing) !== -1) {
                popup.close();
                resolve(popup.location.href);
                return;
            }
        } catch (e) { }
        setTimeout(() => this.watchPopup(popup, resolve, reject), 100);
    }

    protected openCordovaDialog() {
        return new Promise((resolve, reject) => {
            let browserRef = window.open(this.authorizeUrl, "_blank");
            let exitListener = () => reject(new Error("The OSM sign in flow was canceled"));

            browserRef.addEventListener("loaderror",
                () => {
                    browserRef.removeEventListener("exit", exitListener);
                    browserRef.close();
                    reject(new Error("Error loading login page of OSM"));
                });

            browserRef.addEventListener("loadstart",
                async (event: any) => {
                    if (event.url.indexOf(this.options.landing) !== -1) {
                        browserRef.removeEventListener("exit", exitListener);
                        browserRef.close();
                        resolve(event.url);
                    }
                });

            return browserRef.addEventListener("exit", exitListener);
        });
    }

    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, latitude: number, longitude: number): string {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.baseUrl}/edit#${background}&map=${zoom}/${latitude}/${longitude}`;
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
}