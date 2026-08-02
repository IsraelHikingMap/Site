import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { RoutingType, RouteEditingState } from "../models";

export class SetSelectedRouteAction {
    public static readonly type = "[Route Editing] SetSelectedRouteAction";
    constructor(public readonly routeId: string) { }
}

export class SetRoutingTypeAction {
    public static readonly type = "[Route Editing] SetRoutingTypeAction";
    constructor(public readonly routingType: RoutingType) { }
}

export class SetOpacityAction {
    public static readonly type = "[Route Editing] SetOpacityAction";
    constructor(public readonly opacity: number) { }
}

export class SetWeightAction {
    public static readonly type = "[Route Editing] SetWeightAction";
    constructor(public readonly weight: number) { }
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

    @Action(SetOpacityAction)
    public setOpacity(ctx: StateContext<RouteEditingState>, action: SetOpacityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.opacity = action.opacity;
            return lastState;
        }));
    }

    @Action(SetWeightAction)
    public setWeight(ctx: StateContext<RouteEditingState>, action: SetWeightAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.weight = action.weight;
            return lastState;
        }));
    }
}
