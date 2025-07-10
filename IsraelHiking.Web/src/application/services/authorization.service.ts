import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetTokenAction, SetUserInfoAction } from "../reducers/user.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OsmUserDetails } from "../models/models";

@Injectable()
export class AuthorizationService {

    private static readonly OAUTH_CODE = "code";

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private readonly redirectUrl = this.runningContextService.isCapacitor ? Urls.emptyAuthMobileHtml : Urls.emptyAuthHtml;

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
        // this has to be here in order to support safari on desktop since it can only open a window on click event
        const popup = this.openWindow();
        const params = new URLSearchParams({
            client_id: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
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
        const accessTokenUrl =  Urls.osmAuth + "/token";
        const response = await firstValueFrom(this.httpClient.post(accessTokenUrl, null, {
            params: {
                client_id: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
                grant_type: "authorization_code",
                code: oauthCode,
                redirect_uri: this.redirectUrl,
            },
            headers: {"Content-Type": "application/x-www-form-urlencoded" }
        })) as { access_token: string };
        return response.access_token;
    }

    private updateUserDetails = async () => {
        const detailJson = await firstValueFrom(this.httpClient.get(Urls.osmUser)) as OsmUserDetails;
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
        if (this.runningContextService.isCapacitor) {
            return null;
        }
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
            if (!this.runningContextService.isCapacitor) {
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
                    reject(new Error("The OSM sign in flow timed out"))
                }, 5*60000);
            } else {
                const callback = (event: MessageEvent) => {
                    if (event.data.match(/^oauth::/)) {
                        const data = JSON.parse(event.data.substring(7));
                        window.removeEventListener("message", callback);
                        resolve(data[AuthorizationService.OAUTH_CODE]);
                    }
                };
                window.addEventListener("message", callback);

                window.open(authorizeUrl, "oauth:osm", "");
            }
        });
    }
}
