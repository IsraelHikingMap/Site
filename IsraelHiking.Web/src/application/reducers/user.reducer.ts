import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { ActivityType, DeviceProviderId, DeviceProviderConnection, UserInfo, UserState } from "../models";

export class SetUserInfoAction {
    public static readonly type = "[User] SetUserInfoAction";
    constructor(public readonly userInfo: UserInfo) { }
}

export class SetDeviceProviderConnectionAction {
    public static type = this.prototype.constructor.name;
    constructor(public providerId: DeviceProviderId, public token: DeviceProviderConnection) { }
}

export class RemoveDeviceProviderConnectionAction {
    public static type = this.prototype.constructor.name;
    constructor(public providerId: DeviceProviderId) { }
}

export class ToggleDeviceProviderVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public providerId: DeviceProviderId) { }
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

    @Action(SetDeviceProviderConnectionAction)
    public setDeviceProviderConnection(ctx: StateContext<UserState>, action: SetDeviceProviderConnectionAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.connectedDeviceProviders ??= {};
            lastState.connectedDeviceProviders[action.providerId] = action.token;
            return lastState;
        }));
    }

    @Action(RemoveDeviceProviderConnectionAction)
    public removeDeviceProviderConnection(ctx: StateContext<UserState>, action: RemoveDeviceProviderConnectionAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.connectedDeviceProviders ??= {};
            delete lastState.connectedDeviceProviders[action.providerId];
            return lastState;
        }));
    }

    @Action(ToggleDeviceProviderVisibilityAction)
    public toggleDeviceProviderVisibility(ctx: StateContext<UserState>, action: ToggleDeviceProviderVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const hidden = lastState.hiddenDeviceProviders ?? [];
            lastState.hiddenDeviceProviders = hidden.includes(action.providerId)
                ? hidden.filter(id => id !== action.providerId)
                : [...hidden, action.providerId];
            return lastState;
        }));
    }
}
