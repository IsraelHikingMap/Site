import type { DeviceServiceId, RouteDataWithoutState } from "../../models";

/** OAuth token-response shape shared by the device providers. */
export type DeviceTokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
};

/** Everything needed to keep a device service connected and to refresh it. */
export type DeviceConnectionInfo = {
    accessToken: string;
    refreshToken: string;
    codeVerifier: string;
    expiresAt: number;
};

/**
 * A connectable external device service (Wahoo, Garmin, ...) that a planned
 * route can be pushed to. Implementations mirror each other so the settings UI
 * and the send-to-device flow stay provider-agnostic.
 */
export interface DeviceProvider {
    /** Stable id, also the key under userState.connectedDeviceServices. */
    readonly id: DeviceServiceId;
    /** Brand name shown in the UI (not translated). */
    readonly displayName: string;

    /** Runs the OAuth PKCE flow and returns the connection info to persist. */
    login(): Promise<DeviceConnectionInfo>;
    /** Exchanges the stored refresh token for a fresh access token. */
    refresh(connection: DeviceConnectionInfo): Promise<DeviceConnectionInfo>;
    /** Uploads the route to the user's account so it syncs to their device. */
    sendRoute(accessToken: string, route: RouteDataWithoutState): Promise<void>;
}
