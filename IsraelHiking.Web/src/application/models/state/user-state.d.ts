import type { UserInfo } from "..";

export type UserState = {
    userInfo: UserInfo;
    token: string;
    agreedToTheTermsOfService: boolean;
};
