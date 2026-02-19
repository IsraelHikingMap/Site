import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ActivityType, UserInfo, UserState } from "../models";

export class SetUserInfoAction {
    public static type = this.prototype.constructor.name;
    constructor(public userInfo: UserInfo) { }
}

export class SetTokenAction {
    public static type = this.prototype.constructor.name;
    constructor(public token: string) { }
}

export class SetAgreeToTermsAction {
    public static type = this.prototype.constructor.name;
    constructor(public agree: boolean) { }
}

export class SetActivityTypeAction {
    public static type = this.prototype.constructor.name;
    constructor(public activityType: ActivityType) { }
}

@State<UserState>({
    name: "userState",
    defaults: initialState.userState
})
@Injectable()
export class UserInfoReducer {

    @Action(SetUserInfoAction)
    public setUserInfo(ctx: StateContext<UserState>, action: SetUserInfoAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.userInfo = action.userInfo;
            return lastState;
        }));
    }

    @Action(SetTokenAction)
    public setToken(ctx: StateContext<UserState>, action: SetTokenAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.token = action.token;
            return lastState;
        }));
    }

    @Action(SetAgreeToTermsAction)
    public setAgreeToTerms(ctx: StateContext<UserState>, action: SetAgreeToTermsAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.agreedToTheTermsOfService = action.agree;
            return lastState;
        }));
    }

    @Action(SetActivityTypeAction)
    public setActivityType(ctx: StateContext<UserState>, action: SetActivityTypeAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.prefferedActivityType = action.activityType;
            return lastState;
        }));
    }
}
