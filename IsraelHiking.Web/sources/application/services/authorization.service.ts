import { Injectable } from "@angular/core";
import { LocalStorage } from "ngx-store";

import { NonAngularObjectsFactory } from "./non-angular-objects.factory";
import { environment } from "../../environments/environment";

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

@Injectable()
export class AuthorizationService {

    @LocalStorage()
    public osmToken: string = null;

    private options: IAuthorizationServiceOptions;
    private oauthRequestTokenSecret: string;
    private authorizeUrl: string;
    private ohauth: any;

    constructor(private readonly nonAngularObjectsFactory: NonAngularObjectsFactory) {
        this.ohauth = this.nonAngularObjectsFactory.createOhAuth();
        this.oauthRequestTokenSecret = "";
        this.setOptions({});
    }

    public authenticated(): boolean {
        return this.osmToken != null;
    }

    public logout() {
        this.osmToken = null;
    }

    public authenticate = async (): Promise<any> => {
        if (this.authenticated()) {
            return new Promise(() => { });
        }

        this.logout();
        try {
            let url = environment.isCordova
                ? await this.openCordovaDialog()
                : await this.openBrowserDialog();
            let oauthToken = this.ohauth.stringQs(url.split("?")[1]);
            await this.getAccessToken(oauthToken.oauth_token);
        } finally {
            this.refreshAuthorizeUrl();
        }
    }

    private getAccessToken = async (oauthToken) => {
        let accessTokenUrl = this.options.url + "/oauth/access_token";
        let params = this.getParams();
        params.oauth_token = oauthToken;
        params.oauth_signature = this.ohauth.signature(
            this.options.oauthSecret,
            this.oauthRequestTokenSecret,
            this.ohauth.baseString("POST", accessTokenUrl, params));

        let response = await this.xhrPromise(accessTokenUrl, params);
        let accessToken = this.ohauth.stringQs(response);
        this.osmToken = accessToken.oauth_token + ";" + accessToken.oauth_token_secret;
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
}