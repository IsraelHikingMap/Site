import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";
import { UserInfo, UserState } from "../models/models";
import { initialState } from "./initial-state";

const SET_USER_INFO = "SET_USER_INFO";
const SET_TOKEN = "SET_TOKEN";

export interface SetUserInfoPayload {
    userInfo: UserInfo;
}

export interface SetTokenPayload {
    token: string;
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
}

export const userReducer = createReducerFromClass(UserInfoReducer, initialState.userState);
