import type { ActivityType, UserInfo } from "..";

export type DeviceProviderId = "wahoo" | "garmin";

/** Everything needed to keep a device provider connected and to refresh its token. */
export type DeviceProviderConnection = {
    accessToken: string;
    refreshToken: string;
    /** Kept for PKCE refreshes, which require the original code verifier */
    codeVerifier: string;
    /** Epoch milliseconds at which the access token expires */
    expiresAt: number;
};

export type UserState = {
    userInfo: UserInfo;
    token: string;
    agreedToTheTermsOfService: boolean;
    prefferedActivityType: ActivityType;
    connectedDeviceProviders: Partial<Record<DeviceProviderId, DeviceProviderConnection>>;
    /** The providers the user chose not to see in the menus that send a route */
    hiddenDeviceProviders: DeviceProviderId[];
};
