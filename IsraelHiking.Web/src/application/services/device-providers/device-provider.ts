import type { DeviceProviderConnection, DeviceProviderId, RouteDataWithoutState } from "../../models";

/** OAuth token-response shape shared by the device providers. */
export type DeviceProviderTokenResponse = {
    access_token: string;
    refresh_token: string;
    expires_in?: number;
};

/**
 * A device provider (Wahoo, Garmin, ...) whose cloud a planned route can be pushed to,
 * to sync from there to the user's device. Implementations mirror each other so the settings UI
 * and the send-to-device flow stay provider-agnostic.
 */
export interface DeviceProvider {
    /** Stable id, also the key under userState.connectedDeviceProviders. */
    readonly id: DeviceProviderId;
    /** Brand name shown in the UI (not translated). */
    readonly displayName: string;
    /** The provider's app icon, shown next to its name. */
    readonly icon: string;

    /** Runs the OAuth PKCE flow and returns the connection info to persist. */
    login(): Promise<DeviceProviderConnection>;
    /** Exchanges the stored refresh token for a fresh access token. */
    refresh(connection: DeviceProviderConnection): Promise<DeviceProviderConnection>;
    /** Uploads the route to the user's account so it syncs to their device. */
    sendRoute(accessToken: string, route: RouteDataWithoutState): Promise<void>;
    /** Tells the provider the user disconnected, for a provider that requires it. */
    disconnect?(accessToken: string): Promise<void>;
}

