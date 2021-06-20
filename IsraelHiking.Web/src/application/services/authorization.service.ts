import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";

import { RunningContextService } from "./running-context.service";
import { NonAngularObjectsFactory, IOhAuth, IOAuthResponse, IOAuthParams } from "./non-angular-objects.factory";
import { NgRedux, select } from "../reducers/infra/ng-redux.module";
import { SetTokenAction, SetUserInfoAction } from "../reducers/user.reducer";
import { ApplicationState, OsmUserDetails, UserState, UserInfo } from "../models/models";
import { Urls } from "../urls";

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

    private options: IAuthorizationServiceOptions;
    private ohauth: IOhAuth;

    @select((state: ApplicationState) => state.userState)
    private userState$: Observable<UserState>;

    private userState: UserState;

    constructor(private readonly httpClient: HttpClient,
                private readonly runningContextService: RunningContextService,
                private readonly nonAngularObjectsFactory: NonAngularObjectsFactory,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.ohauth = this.nonAngularObjectsFactory.createOhAuth();
        this.setOptions({});
        this.userState$.subscribe(us => this.userState = us);
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
        this.ngRedux.dispatch(new SetUserInfoAction({ userInfo: null }));
        this.ngRedux.dispatch(new SetTokenAction({ token: null }));
    }

    public async login(): Promise<void> {
        if (this.isLoggedIn()) {
            return;
        }

        this.logout();
        let popup = this.openWindow(); // this has to be here in order to support browsers that only open a window on click event
        let data = await this.httpClient.get(Urls.osmConfiguration).toPromise() as IOsmConfiguration;
        this.setOptions({
            oauthConsumerKey: data.consumerKey,
            oauthSecret: data.consumerSecret,
            landing: Urls.emptyHtml,
            url: data.baseAddress
        } as IAuthorizationServiceOptions);

        let requestTokenResponse = await this.getRequestToken();
        let authorizeUrl = this.options.url + "/oauth/authorize?" + this.ohauth.qsString({
            oauth_token: requestTokenResponse.oauth_token,
            oauth_callback: this.options.landing
        });
        let urlWhenWindowsCloses = await this.getUrlWhenWindowsCloses(popup, authorizeUrl);
        let oauthToken = this.ohauth.stringQs(urlWhenWindowsCloses.split("?")[1]);
        let accessToken = await this.getAccessToken(oauthToken.oauth_token, requestTokenResponse.oauth_token_secret);
        this.ngRedux.dispatch(new SetTokenAction({
            token: accessToken.oauth_token + ";" + accessToken.oauth_token_secret
        }));
        await this.updateUserDetails();
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
            userInfo
        }));
    };

    private async getAccessToken(oauthToken: string, oauthRequestTokenSecret: string): Promise<IOAuthResponse> {
        let accessTokenUrl = this.options.url + "/oauth/access_token";
        let params = this.getParams();
        params.oauth_token = oauthToken;
        params.oauth_signature = this.ohauth.signature(
            this.options.oauthSecret,
            oauthRequestTokenSecret,
            this.ohauth.baseString("POST", accessTokenUrl, params));

        let response = await this.xhrPromise(accessTokenUrl, params);
        return this.ohauth.stringQs(response);
    }

    private setOptions(options) {
        this.options = options;
        this.options.url = this.options.url || "https://www.openstreetmap.org";
        this.options.landing = this.options.landing || "land.html";
    }

    private async getRequestToken(): Promise<IOAuthResponse> {
        let params = this.getParams();
        let requestTokenUrl = this.options.url + "/oauth/request_token";

        params.oauth_signature = this.ohauth.signature(
            this.options.oauthSecret,
            "",
            this.ohauth.baseString("POST", requestTokenUrl, params));

        let response = await this.xhrPromise(requestTokenUrl, params);
        return this.ohauth.stringQs(response) as IOAuthResponse;
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

    private openWindow(): any {
        if (this.runningContextService.isCordova) {
            return null;
        }
        // Create a 600x550 popup window in the center of the screen
        let w = 600;
        let h = 550;
        let settings = [
            ["width", w], ["height", h],
            ["left", screen.width / 2 - w / 2],
            ["top", screen.height / 2 - h / 2]
        ].map((x) => x.join("=")).join(",");

        return window.open("about:blank", "Authorization", settings);
    }

    private getUrlWhenWindowsCloses(popup: any, authorizeUrl: string): Promise<any> {
        return new Promise((resolve, reject) => {
            if (!this.runningContextService.isCordova) {
                popup.location.href = authorizeUrl;
                if (typeof popup.focus === "function") {
                    popup.focus();
                }
                setTimeout(() => this.watchPopup(popup, resolve, reject), 100);
            } else {
                popup = window.open(authorizeUrl, "_blank");
                let exitListener = () => reject(new Error("The OSM sign in flow was canceled"));

                popup.addEventListener("loaderror",
                    () => {
                        popup.removeEventListener("exit", exitListener);
                        popup.close();
                        reject(new Error("Error loading login page of OSM"));
                    });

                popup.addEventListener("loadstart",
                    async (event: any) => {
                        if (event.url.indexOf(this.options.landing) !== -1) {
                            popup.removeEventListener("exit", exitListener);
                            popup.close();
                            resolve(event.url);
                        }
                    });

                return popup.addEventListener("exit", exitListener);
            }
        });
    }

    private async watchPopup(popup, resolve: (value?: any) => void, reject: (value?: any) => void) {
        try {
            if (popup.closed) {
                reject(new Error("The OSM sign in flow was canceled"));
                return;
            }
            if (popup.location.href.indexOf(this.options.landing) !== -1) {
                popup.close();
                resolve(popup.location.href);
                return;
            }
        } catch { }
        setTimeout(() => this.watchPopup(popup, resolve, reject), 100);
    }

    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, latitude: number, longitude: number): string {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.options.url}/edit#${background}&map=${zoom}/${latitude}/${longitude}`;
    }

    public getEditOsmGpxAddress(baseLayerAddress: string, gpxId: string) {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.options.url}/edit?gpx=${gpxId}#${background}`;
    }

    public getEditElementOsmAddress(baseLayerAddress: string, id: string) {
        let elementType = id.split("_")[0];
        let elementId = id.split("_")[1];
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${this.options.url}/edit?${elementType}=${elementId}#${background}`;
    }

    public getElementOsmAddress(id: string) {
        let elementType = id.split("_")[0];
        let elementId = id.split("_")[1];
        return `${this.options.url}/${elementType}/${elementId}`;
    }

    private getBackgroundStringForOsmAddress(baseLayerAddress: string): string {
        let background = "background=bing";
        if (baseLayerAddress !== "") {
            if (baseLayerAddress.startsWith("/")) {
                baseLayerAddress = Urls.baseTilesAddress + baseLayerAddress;
            }
            let address = baseLayerAddress.replace("{s}", "s");
            background = `background=custom:${encodeURIComponent(address)}`;
        }
        return background;
    }
}
