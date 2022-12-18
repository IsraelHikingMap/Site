import { Action, AbstractReducer, ActionsReducer } from "@angular-redux2/store";

import type { UserInfo, UserState } from "../models/models";

export type SetUserInfoPayload = {
    userInfo: UserInfo;
};

export type SetTokenPayload = {
    token: string;
};

export type SetArgreeToTermsPayload = {
    agree: boolean;
};

export class UserInfoReducer extends AbstractReducer {
    static actions: ActionsReducer<UserInfoReducer>;

    @Action
    public setUserInfo(lastState: UserState, payload: SetUserInfoPayload): UserState {
        lastState.userInfo = payload.userInfo;
        return lastState;
    }

    @Action
    public setToken(lastState: UserState, payload: SetTokenPayload): UserState {
        lastState.token = payload.token;
        return lastState;
    }

    @Action
    public setAgreeToTerms(lastState: UserState, payload: SetArgreeToTermsPayload): UserState {
        lastState.agreedToTheTermsOfService = payload.agree;
        return lastState;
    }
}
