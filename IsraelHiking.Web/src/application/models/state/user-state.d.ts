import { UserInfo } from "../models";

export interface UserState {
    userInfo: UserInfo;
    token: string;
    agreedToTheTermsOfService: boolean;
}