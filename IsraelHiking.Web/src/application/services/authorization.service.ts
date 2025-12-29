import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { SocialLogin } from "@capgo/capacitor-social-login";

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
        SocialLogin.initialize({
            oauth2: {
                osm: {
                    appId: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
                    redirectUrl: this.redirectUrl,
                    scope: "read_prefs write_api read_gpx write_gpx",
                    authorizationBaseUrl: Urls.osmAuth + "/authorize",
                    accessTokenEndpoint: Urls.osmAuth + "/token",
                    responseType: "code",
                    logsEnabled: true, // HM TODO: remove this?
                    pkceEnabled: false
                }
            },

        });
    }

    public isLoggedIn(): boolean {
        const userState = this.store.selectSnapshot((s: ApplicationState) => s.userState);
        return userState.userInfo != null;
    }

    public logout() {
        SocialLogin.logout({
            provider: "oauth2",
            providerId: "osm"
        });
        this.store.dispatch(new SetUserInfoAction(null));
        this.store.dispatch(new SetTokenAction(null));
    }

    public async login(): Promise<void> {
        if (this.isLoggedIn()) {
            return;
        }
        this.loggingService.info("[Authorization] User initiated login");
        const result = await SocialLogin.login({
            provider: "oauth2",
            options: {
                providerId: "osm"
            }
        });
        this.store.dispatch(new SetTokenAction(result.result.accessToken.token));
        await this.updateUserDetails();
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
