import type { ActivityType, UserInfo } from "..";

export type UserState = {
    userInfo: UserInfo;
    token: string;
    agreedToTheTermsOfService: boolean;
    prefferedActivityType: ActivityType
};
