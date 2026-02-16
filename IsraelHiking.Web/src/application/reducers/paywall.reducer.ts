import { Injectable } from "@angular/core";
import { State, Action, StateContext } from "@ngxs/store";

import type { PaywallState } from "../models";
import { initialState } from "./initial-state";
import { produce } from "immer";

export class SetLastPaywallShownDate {
    public static type = this.prototype.constructor.name;
    constructor(public lastPaywallShownDate: Date | null) { }
}

export class IncrementAppLaunchesSinceLastPaywallShown {
    public static type = this.prototype.constructor.name;
    constructor() { }
}

@State<PaywallState>({
    name: "paywallState",
    defaults: initialState.paywallState
})
@Injectable()
export class PaywallReducer {
    @Action(SetLastPaywallShownDate)
    setLastPaywallShownDate(ctx: StateContext<PaywallState>, action: SetLastPaywallShownDate) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.lastPaywallShownDate = action.lastPaywallShownDate;
            lastState.appLaunchesSinceLastPaywallShown = 0;
        }));
    }

    @Action(IncrementAppLaunchesSinceLastPaywallShown)
    incrementAppLaunchesSinceLastPaywallShown(ctx: StateContext<PaywallState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.appLaunchesSinceLastPaywallShown = lastState.appLaunchesSinceLastPaywallShown + 1;
        }));
    }
}