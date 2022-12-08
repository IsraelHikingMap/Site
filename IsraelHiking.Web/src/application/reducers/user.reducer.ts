import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

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
    static actions: {
        setUserInfo: ActionPayload<SetUserInfoPayload>;
        setToken: ActionPayload<SetTokenPayload>;
        setAgreeToTerms: ActionPayload<SetArgreeToTermsPayload>;
    };

    @Action
    public setUserInfo(lastState: UserState, action: AnyAction<SetUserInfoPayload>) {
        lastState.userInfo = action.payload.userInfo;
        return lastState;
    }

    @Action
    public setToken(lastState: UserState, action: AnyAction<SetTokenPayload>) {
        lastState.token = action.payload.token;
        return lastState;
    }

    @Action
    public setAgreeToTerms(lastState: UserState, action: AnyAction<SetArgreeToTermsPayload>) {
        lastState.agreedToTheTermsOfService = action.payload.agree;
        return lastState;
    }
}
