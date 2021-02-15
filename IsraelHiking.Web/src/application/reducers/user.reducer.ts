import { ReduxAction, BaseAction, createReducerFromClass } from "./infra/ng-redux.module";
import { UserInfo, UserState } from "../models/models";
import { initialState } from "./initial-state";

const SET_USER_INFO = "SET_USER_INFO";
const SET_TOKEN = "SET_TOKEN";
const SET_AGREED_TO_TERMS = "SET_AGREED_TO_TERMS";

export interface SetUserInfoPayload {
    userInfo: UserInfo;
}

export interface SetTokenPayload {
    token: string;
}

export interface SetArgreeToTermsPayload {
    agree: boolean;
}

export class SetUserInfoAction extends BaseAction<SetUserInfoPayload> {
    constructor(payload: SetUserInfoPayload) {
         super(SET_USER_INFO, payload);
    }
}

export class SetTokenAction extends BaseAction<SetTokenPayload> {
    constructor(payload: SetTokenPayload) {
        super(SET_TOKEN, payload);
    }
}

export class SetAgreeToTermsAction extends BaseAction<SetArgreeToTermsPayload> {
    constructor(payload: SetArgreeToTermsPayload) {
        super(SET_AGREED_TO_TERMS, payload);
    }
}

export class UserInfoReducer {
    @ReduxAction(SET_USER_INFO)
    public setUserInfo(lastState: UserState, action: SetUserInfoAction) {
        return {
            ...lastState,
            userInfo: action.payload.userInfo
        };
    }

    @ReduxAction(SET_TOKEN)
    public setToken(lastState: UserState, action: SetTokenAction) {
        return {
            ...lastState,
            token: action.payload.token
        };
    }

    @ReduxAction(SET_AGREED_TO_TERMS)
    public setTAgreeToTerms(lastState: UserState, action: SetAgreeToTermsAction) {
        return {
            ...lastState,
            agreedToTheTermsOfService: action.payload.agree
        };
    }
}

export const userReducer = createReducerFromClass(UserInfoReducer, initialState.userState);
