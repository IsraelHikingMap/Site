import type { ActivityType, UserInfo } from "..";

export type DeviceServiceId = "wahoo";

export type DeviceServiceToken = {
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
    connectedDeviceServices: Partial<Record<DeviceServiceId, DeviceServiceToken>>;
};
