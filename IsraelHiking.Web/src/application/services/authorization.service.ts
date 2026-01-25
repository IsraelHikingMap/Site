import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { registerPlugin } from '@capacitor/core';

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetTokenAction, SetUserInfoAction } from "../reducers/user.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OsmUserDetails } from "../models";

type OAuthOptions = {
    authEndpoint: string;
}

interface OAuthPlugin {
    startOAuth(options: OAuthOptions): Promise<Record<string, string>>;
}

const OAuth = registerPlugin<OAuthPlugin>('OAuth', {
    web: () => new WebOAuthPlugin(),
});


class WebOAuthPlugin implements OAuthPlugin {

    private openWindow(authorizeUrl: string): Window {
        // Create a 600x550 popup window in the center of the screen
        const w = 600;
        const h = 550;
        const settings = [
            ["width", w], ["height", h],
            ["left", screen.width / 2 - w / 2],
            ["top", screen.height / 2 - h / 2]
        ].map((x) => x.join("=")).join(",");

        return window.open(authorizeUrl, "Authorization", settings);
    }

    startOAuth(options: OAuthOptions): Promise<Record<string, string>> {
        const popup = this.openWindow(options.authEndpoint);
        if (typeof popup.focus === "function") {
            popup.focus();
        }
        return new Promise((resolve, reject) => {
            const bc = new BroadcastChannel("osm-api-auth-complete");
            bc.addEventListener("message", (event) => {
                const redirectedUrl = new URL(event.data);
                bc.close();
                const results: Record<string, string> = {};
                for (let sp of redirectedUrl.searchParams) {
                    results[sp[0]] = sp[1];
                }
                resolve(results);
            });
            setTimeout(() => {
                bc.close();
                reject(new Error("The OSM sign in flow timed out"))
            }, 5 * 60000);
        });
    }
}

@Injectable()
export class AuthorizationService {

    private static readonly OAUTH_CODE = "code";

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private readonly redirectUrl = this.runningContextService.isCapacitor ? Urls.mapeakAuthUrl : Urls.emptyAuthHtml;

    public isLoggedIn(): boolean {
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        return userState.userInfo != null;
    }

    public logout() {
        this.store.dispatch(new SetUserInfoAction(null));
        this.store.dispatch(new SetTokenAction(null));
    }

    public async login(): Promise<void> {
        if (this.isLoggedIn()) {
            return;
        }
        this.loggingService.info("[Authorization] User initiated login");
        this.logout();
        const params = new URLSearchParams({
            client_id: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
            redirect_uri: this.redirectUrl,
            response_type: "code",
            scope: "read_prefs write_api read_gpx write_gpx"
        });
        const authEndpoint = Urls.osmAuth + "/authorize?" + params.toString();
        const result = await OAuth.startOAuth({ authEndpoint });
        const oauthCode = result[AuthorizationService.OAUTH_CODE];
        const accessToken = await this.getAccessToken(oauthCode);
        this.store.dispatch(new SetTokenAction(accessToken));
        await this.updateUserDetails();
    }

    private async getAccessToken(oauthCode: string): Promise<string> {
        const accessTokenUrl = Urls.osmAuth + "/token";
        const response = await firstValueFrom(this.httpClient.post<{ access_token: string }>(accessTokenUrl, null, {
            params: {
                client_id: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
                grant_type: "authorization_code",
                code: oauthCode,
                redirect_uri: this.redirectUrl,
            },
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }));
        return response.access_token;
    }

    private updateUserDetails = async () => {
        const detailJson = await firstValueFrom(this.httpClient.get<OsmUserDetails>(Urls.osmUser));
        const userInfo = {
            displayName: detailJson.user.display_name,
            id: detailJson.user.id.toString(),
            changeSets: detailJson.user.changesets.count,
            imageUrl: detailJson.user.img?.href
        };
        this.store.dispatch(new SetUserInfoAction(userInfo));
        this.loggingService.info(`[Authorization] User ${userInfo.displayName} logged-in successfully`);
    };
}
