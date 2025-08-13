import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { RoutingType, RouteEditingState } from "../models";

export class SetSelectedRouteAction {
    public static type = this.prototype.constructor.name;
    constructor(public routeId: string) {}
}

export class SetRoutingTypeAction {
    public static type = this.prototype.constructor.name;
    constructor(public routingType: RoutingType) {}
}

export class SetOpacityAndWeightAction {
    public static type = this.prototype.constructor.name;
    constructor(public opacity: number, public weight: number) {}
}

@State<RouteEditingState>({
    name: "routeEditingState",
    defaults: initialState.routeEditingState
})
@Injectable()
export class RouteEditingReducer {

    @Action(SetSelectedRouteAction)
    public setSelectedRoute(ctx: StateContext<RouteEditingState>, action: SetSelectedRouteAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.selectedRouteId = action.routeId;
            return lastState;
        }));
    }

    @Action(SetRoutingTypeAction)
    public setRoutingType(ctx: StateContext<RouteEditingState>, action: SetRoutingTypeAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.routingType = action.routingType;
            return lastState;
        }));
    }

    @Action(SetOpacityAndWeightAction)
    public setOpacityAndWeight(ctx: StateContext<RouteEditingState>, action: SetOpacityAndWeightAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.opacity = action.opacity;
            lastState.weight = action.weight;
            return lastState;
        }));
    }
}
