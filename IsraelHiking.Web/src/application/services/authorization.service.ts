import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, Observable } from "rxjs";
import { NgRedux, Select } from "@angular-redux2/store";

import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { UserInfoReducer } from "../reducers/user.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OsmUserDetails, UserState, UserInfo } from "../models/models";

@Injectable()
export class AuthorizationService {

    private static readonly OAUTH_CODE = "code";

    private readonly redirectUrl: string;

    @Select((state: ApplicationState) => state.userState)
    private userState$: Observable<UserState>;

    private userState: UserState;

    constructor(private readonly httpClient: HttpClient,
                private readonly runningContextService: RunningContextService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.redirectUrl = this.runningContextService.isCapacitor ? "ihm://oauth_callback/" : Urls.emptyAuthHtml;
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
        this.ngRedux.dispatch(UserInfoReducer.actions.setUserInfo({ userInfo: null }));
        this.ngRedux.dispatch(UserInfoReducer.actions.setToken({ token: null }));
    }

    public async login(): Promise<void> {
        if (this.isLoggedIn()) {
            return;
        }
        this.loggingService.info("[Authorization] User initiated login");
        this.logout();
        // this has to be here in order to support safari on desktop since it can only open a window on click event
        let popup = this.openWindow();
        let params = new URLSearchParams({
            client_id: "jqxu2hhG-gUa-XUxiepzkQPZQf7iQguMC0sTVSRpaKE",
            redirect_uri: this.redirectUrl,
            response_type: "code",
            scope: "read_prefs write_api read_gpx write_gpx"
        });
        let oauthCode = await this.getCodeFromWindow(popup, Urls.osmAuth + "/authorize?" + params.toString());
        let accessToken = await this.getAccessToken(oauthCode);
        this.ngRedux.dispatch(UserInfoReducer.actions.setToken({
            token: accessToken
        }));
        await this.updateUserDetails();
    }

    private async getAccessToken(oauthCode: string): Promise<string> {
        let accessTokenUrl =  Urls.osmAuth + "/token";
        let response = await firstValueFrom(this.httpClient.post(accessTokenUrl, null, {
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
        let detailJson = await firstValueFrom(this.httpClient.get(Urls.osmUser)) as OsmUserDetails;
        let userInfo = {
            displayName: detailJson.displayName,
            id: detailJson.id,
            changeSets: detailJson.changeSetCount,
            imageUrl: detailJson.image
        };
        this.ngRedux.dispatch(UserInfoReducer.actions.setUserInfo({
            userInfo
        }));
        this.loggingService.info(`[Authorization] User ${userInfo.displayName} logged-in successfully`);
    };

    private openWindow(): Window {
        if (this.runningContextService.isCapacitor) {
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

    private getCodeFromWindow(popup: Window, authorizeUrl: string): Promise<string> {
        return new Promise((resolve, reject) => {
            if (!this.runningContextService.isCapacitor) {
                popup.location.href = authorizeUrl;
                if (typeof popup.focus === "function") {
                    popup.focus();
                }
                setTimeout(() => this.watchPopup(popup, resolve, reject), 100);
            } else {
                let callback = (event: MessageEvent) => {
                    if (event.data.match(/^oauth::/)) {
                        let data = JSON.parse(event.data.substring(7));
                        window.removeEventListener("message", callback);
                        resolve(data[AuthorizationService.OAUTH_CODE]);
                    }
                };
                window.addEventListener("message", callback);

                window.open(authorizeUrl, "oauth:osm", "");
            }
        });
    }

    private async watchPopup(popup: Window, resolve: (value: string) => void, reject: (value: Error) => void) {
        try {
            if (popup.closed) {
                reject(new Error("The OSM sign in flow was canceled"));
                return;
            }
            if (popup.location.href.startsWith(this.redirectUrl)) {
                popup.close();
                let redirectedUrl = new URL(popup.location.href);
                resolve(redirectedUrl.searchParams.get(AuthorizationService.OAUTH_CODE));
                return;
            }
        } catch { }
        setTimeout(() => this.watchPopup(popup, resolve, reject), 100);
    }

    public getEditOsmLocationAddress(baseLayerAddress: string, zoom: number, latitude: number, longitude: number): string {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${Urls.osmBase}/edit#${background}&map=${zoom}/${latitude}/${longitude}`;
    }

    public getEditOsmGpxAddress(baseLayerAddress: string, gpxId: string) {
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${Urls.osmBase}/edit?gpx=${gpxId}#${background}`;
    }

    public getEditElementOsmAddress(baseLayerAddress: string, id: string) {
        let elementType = id.split("_")[0];
        let elementId = id.split("_")[1];
        let background = this.getBackgroundStringForOsmAddress(baseLayerAddress);
        return `${Urls.osmBase}/edit?${elementType}=${elementId}#${background}`;
    }

    public getElementOsmAddress(id: string) {
        let elementType = id.split("_")[0];
        let elementId = id.split("_")[1];
        return `${Urls.osmBase}/${elementType}/${elementId}`;
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
