import type { UserInfo } from "../models";

export type UserState = {
    userInfo: UserInfo;
    token: string;
    agreedToTheTermsOfService: boolean;
}
