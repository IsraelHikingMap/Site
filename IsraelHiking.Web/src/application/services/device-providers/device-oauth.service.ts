import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { InAppBrowser } from "@capgo/capacitor-inappbrowser";

import { RunningContextService } from "../running-context.service";
import { Urls } from "../../urls";
import type { DeviceTokenResponse } from "./device-provider";

/**
 * Shared OAuth 2.0 PKCE helper for the external device services. Mirrors the OSM
 * login in authorization.service.ts (InAppBrowser secure window + broadcast
 * channel) but adds PKCE so no client secret is needed and the whole flow can
 * run client-side. The token exchange is POSTed through the nginx proxy (the
 * caller passes a proxied token URL) to avoid CORS on the web.
 */
@Service()
export class DeviceOAuthService {

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
     */
    public async authorize(authorizeUrl: string, clientId: string, scope: string | null, codeChallenge: string): Promise<string> {
        const params = new URLSearchParams({
            client_id: clientId,
            redirect_uri: this.redirectUrl,
            response_type: "code",
            code_challenge: codeChallenge,
            code_challenge_method: "S256"
        });
        if (scope) {
            params.set("scope", scope);
        }
        const result = await InAppBrowser.openSecureWindow({
            authEndpoint: authorizeUrl + "?" + params.toString(),
            redirectUri: this.redirectUrl,
            broadcastChannelName: DeviceOAuthService.AUTH_CHANNEL
        });
        const code = new URL(result.redirectedUri).searchParams.get("code");
        if (!code) {
            throw new Error("Authorization was cancelled or failed");
        }
        return code;
    }

    public async exchangeToken(tokenUrl: string, body: Record<string, string>): Promise<DeviceTokenResponse> {
        return firstValueFrom(this.httpClient.post<DeviceTokenResponse>(tokenUrl, new URLSearchParams(body).toString(), {
            headers: { "Content-Type": "application/x-www-form-urlencoded" }
        }));
    }

    private base64UrlEncode(bytes: Uint8Array): string {
        let binary = "";
        for (const byte of bytes) {
            binary += String.fromCharCode(byte);
        }
        return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
    }
}
