import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { InAppBrowser } from "@capgo/inappbrowser";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { SetTokenAction, SetUserInfoAction } from "../reducers/user.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OsmUserDetails } from "../models";

@Injectable()
export class AuthorizationService {

    private static readonly OAUTH_CODE = "code";

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private readonly redirectUrl = this.runningContextService.isCapacitor ? Urls.mapeakAuthUrl : Urls.emptyAuthHtml;

    public initialize() {

    }

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
        const params = new URLSearchParams({
            client_id: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
            redirect_uri: this.redirectUrl,
            response_type: "code",
            scope: "read_prefs write_api read_gpx write_gpx"
        });
        const result = await InAppBrowser.openSecureWindow({
            authEndpoint: Urls.osmAuth + "/authorize?" + params.toString(),
            redirectUri: this.redirectUrl,
            broadcastChannelName: "osm-oauth2"
        });
        const redirectedUrl = new URL(result.redirectedUri);
        const code = redirectedUrl.searchParams.get(AuthorizationService.OAUTH_CODE);
        const accessToken = await this.getAccessToken(code);
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
