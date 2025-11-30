import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { GenericOAuth2, type OAuth2AuthenticateOptions } from "@capacitor-community/generic-oauth2";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetTokenAction, SetUserInfoAction } from "../reducers/user.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OsmUserDetails } from "../models";

@Injectable()
export class AuthorizationService {

    private static readonly OAUTH_CODE = "code";
    private static readonly CLIENT_ID = "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE";

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private readonly redirectUrl = this.runningContextService.isCapacitor ? Urls.ihmAuthUrl : Urls.emptyAuthHtml;

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

        if (this.runningContextService.isCapacitor) {
            await this.loginWithCapacitorOAuth();
        } else {
            await this.loginWithPopup();
        }
    }

    private async loginWithCapacitorOAuth(): Promise<void> {
        const oauth2Options: OAuth2AuthenticateOptions = {
            appId: AuthorizationService.CLIENT_ID,
            authorizationBaseUrl: Urls.osmAuth + "/authorize",
            accessTokenEndpoint: Urls.osmAuth + "/token",
            scope: "read_prefs write_api read_gpx write_gpx",
            responseType: "code",
            pkceEnabled: false,
            web: {
                redirectUrl: this.redirectUrl,
                windowTarget: "_blank"
            },
            android: {
                redirectUrl: this.redirectUrl
            },
            ios: {
                redirectUrl: this.redirectUrl
            }
        };

        try {
            const response = await GenericOAuth2.authenticate(oauth2Options);
            const accessToken = response.access_token as string;
            this.store.dispatch(new SetTokenAction(accessToken));
            await this.updateUserDetails();
        } catch (error) {
            this.loggingService.error(`[Authorization] OAuth failed: ${(error as Error).message}`);
            throw error;
        }
    }

    private async loginWithPopup(): Promise<void> {
        // this has to be here in order to support safari on desktop since it can only open a window on click event
        const popup = this.openWindow();
        const params = new URLSearchParams({
            client_id: AuthorizationService.CLIENT_ID,
            redirect_uri: this.redirectUrl,
            response_type: "code",
            scope: "read_prefs write_api read_gpx write_gpx"
        });
        const oauthCode = await this.getCodeFromWindow(popup, Urls.osmAuth + "/authorize?" + params.toString());
        const accessToken = await this.getAccessToken(oauthCode);
        this.store.dispatch(new SetTokenAction(accessToken));
        await this.updateUserDetails();
    }

    private async getAccessToken(oauthCode: string): Promise<string> {
        const accessTokenUrl = Urls.osmAuth + "/token";
        const response = await firstValueFrom(this.httpClient.post<{ access_token: string }>(accessTokenUrl, null, {
            params: {
                client_id: AuthorizationService.CLIENT_ID,
                grant_type: "authorization_code",
                code: oauthCode,
                redirect_uri: this.redirectUrl,
            },
            headers: {"Content-Type": "application/x-www-form-urlencoded" }
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

    private openWindow(): Window {
        // Create a 600x550 popup window in the center of the screen
        const w = 600;
        const h = 550;
        const settings = [
            ["width", w], ["height", h],
            ["left", screen.width / 2 - w / 2],
            ["top", screen.height / 2 - h / 2]
        ].map((x) => x.join("=")).join(",");

        return window.open("about:blank", "Authorization", settings);
    }

    private getCodeFromWindow(popup: Window, authorizeUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (typeof popup.focus === "function") {
                popup.focus();
            }
            popup.location.href = authorizeUrl;
            const bc = new BroadcastChannel("osm-api-auth-complete");
            bc.addEventListener("message", (event) => {
                const redirectedUrl = new URL(event.data);
                bc.close();
                resolve(redirectedUrl.searchParams.get(AuthorizationService.OAUTH_CODE));
            });
            setTimeout(() => {
                bc.close();
                reject(new Error("The OSM sign in flow timed out"));
            }, 5*60000);
        });
    }
}
