import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ActivityType, DeviceServiceId, DeviceServiceToken, UserInfo, UserState } from "../models";

export class SetUserInfoAction {
    public static readonly type = "[User] SetUserInfoAction";
    constructor(public readonly userInfo: UserInfo) { }
}

export class SetDeviceServiceTokenAction {
    public static type = this.prototype.constructor.name;
    constructor(public serviceId: DeviceServiceId, public token: DeviceServiceToken) { }
}

export class RemoveDeviceServiceAction {
    public static type = this.prototype.constructor.name;
    constructor(public serviceId: DeviceServiceId) { }
}

export class SetTokenAction {
    public static readonly type = "[User] SetTokenAction";
    constructor(public readonly token: string) { }
}

export class SetAgreeToTermsAction {
    public static readonly type = "[User] SetAgreeToTermsAction";
    constructor(public readonly agree: boolean) { }
}

export class SetActivityTypeAction {
    public static readonly type = "[User] SetActivityTypeAction";
    constructor(public readonly activityType: ActivityType) { }
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

    @Action(SetDeviceServiceTokenAction)
    public setDeviceServiceToken(ctx: StateContext<UserState>, action: SetDeviceServiceTokenAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.connectedDeviceServices ??= {};
            lastState.connectedDeviceServices[action.serviceId] = action.token;
            return lastState;
        }));
    }

    @Action(RemoveDeviceServiceAction)
    public removeDeviceService(ctx: StateContext<UserState>, action: RemoveDeviceServiceAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.connectedDeviceServices ??= {};
            delete lastState.connectedDeviceServices[action.serviceId];
            return lastState;
        }));
    }
}
