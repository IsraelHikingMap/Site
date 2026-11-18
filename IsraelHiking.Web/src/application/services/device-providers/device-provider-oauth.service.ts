import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { InAppBrowser } from "@capgo/capacitor-inappbrowser";
import { encode } from "base64-arraybuffer";

import { RunningContextService } from "../running-context.service";
import { Urls } from "../../urls";
import type { DeviceProviderTokenResponse } from "./device-provider";

/**
 * Shared OAuth 2.0 PKCE helper for the device providers. Mirrors the OSM
 * login in authorization.service.ts (InAppBrowser secure window + broadcast
 * channel) but adds PKCE so no client secret is needed and the whole flow can
 * run client-side. The token exchange is POSTed through the nginx proxy (the
 * caller passes a proxied token URL) to avoid CORS on the web.
 */
@Service()
export class DeviceProviderOAuthService {

    /**
     * Its own channel and redirect page, so a device login never clashes with the OSM login, which uses
     * "osm-api-auth-complete" and empty-for-oauth.html.
     */
    private static readonly AUTH_CHANNEL = "device-auth-complete";

    private readonly httpClient = inject(HttpClient);
    private readonly runningContextService = inject(RunningContextService);

    private readonly redirectUrl = this.runningContextService.isCapacitor ? Urls.mapeakAuthUrl : Urls.deviceAuthHtml;

    public getRedirectUri(): string {
        return this.redirectUrl;
    }

    public async generatePkcePair(): Promise<{ verifier: string; challenge: string }> {
        const verifier = this.base64UrlEncode(crypto.getRandomValues(new Uint8Array(48)));
        const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
        const challenge = this.base64UrlEncode(new Uint8Array(digest));
        return { verifier, challenge };
    }

    /**
     * Opens the provider's authorize page and returns the authorization code.
     * The scope is omitted for a provider, like Garmin, whose permissions are chosen by the user on its own page.
     * A provider that allows a single redirect uri passes the server's callback, which uses the state's
     * "app-" or "web-" prefix to send the result on to {@link getRedirectUri}.
     */
    public async authorize(authorizeUrl: string, clientId: string, scope: string | null, codeChallenge: string,
        providerRedirectUri = this.redirectUrl): Promise<string> {
        const state = (this.runningContextService.isCapacitor ? "app-" : "web-") + this.base64UrlEncode(crypto.getRandomValues(new Uint8Array(16)));
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: providerRedirectUri,
            response_type: "code",
            state,
            code_challenge: codeChallenge,
            code_challenge_method: "S256"
        });
        if (scope) {
            params.set("scope", scope);
        }
        const result = await InAppBrowser.openSecureWindow({
            authEndpoint: authorizeUrl + "?" + params.toString(),
            redirectUri: this.redirectUrl,
            broadcastChannelName: DeviceProviderOAuthService.AUTH_CHANNEL
        });
        const searchParams = new URL(result.redirectedUri).searchParams;
        if (searchParams.has("error")) {
            throw new Error(`Authorization failed: ${searchParams.get("error")} ${searchParams.get("error_description") ?? ""}`);
        }
        if (searchParams.get("state") !== state) {
            throw new Error(`Authorization state does not match, got: ${searchParams.get("state")}`);
        }
        const code = searchParams.get("code");
        if (!code) {
            throw new Error(`Authorization returned no code, got parameters: ${[...searchParams.keys()].join(", ")}`);
        }
        return code;
    }

    public async exchangeToken(tokenUrl: string, body: Record<string, string>): Promise<DeviceProviderTokenResponse> {
        return firstValueFrom(this.httpClient.post<DeviceProviderTokenResponse>(tokenUrl, new URLSearchParams(body).toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }));
    }

    private base64UrlEncode(bytes: Uint8Array<ArrayBuffer>): string {
        return encode(bytes.buffer).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
}
