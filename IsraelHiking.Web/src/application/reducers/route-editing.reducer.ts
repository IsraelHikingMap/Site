import { Action, AbstractReducer, ReducerActions } from "@angular-redux2/store";

import type { RoutingType, RouteEditingState } from "../models/models";

export type RoutePayload = {
    routeId: string;
};

export type SetRoutingTypePayload = {
    routingType: RoutingType;
};

export type SetOpacityAndWeightPayload = {
    opacity: number;
    weight: number;
};

export class RouteEditingReducer extends AbstractReducer {
    static actions: ReducerActions<RouteEditingReducer>;

    @Action
    public setSelectedRoute(lastState: RouteEditingState, payload: RoutePayload): RouteEditingState {
        lastState.selectedRouteId = payload.routeId;
        return lastState;
    }

    @Action
    public setRoutingType(lastState: RouteEditingState, payload: SetRoutingTypePayload): RouteEditingState {
        lastState.routingType = payload.routingType;
        return lastState;
    }

    @Action
    public setOpacityAndWeight(lastState: RouteEditingState, payload: SetOpacityAndWeightPayload): RouteEditingState {
        lastState.opacity = payload.opacity;
        lastState.weight = payload.weight;
        return lastState;
    }
}
