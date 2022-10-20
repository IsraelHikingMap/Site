import { Action as ReduxAction, createReducerFromClass } from "@angular-redux2/store";

import { initialState, BaseAction } from "./initial-state";
import type { RoutingType, RouteEditingState } from "../models/models";

const SET_ROUTING_TYPE = "SET_ROUTING_TYPE";
const SET_SELECTED_ROUTE = "SET_SELECTED_ROUTE";
const SET_OPACITY_AND_WEIGHT = "SET_OPACITY_AND_WEIGHT";

export type RoutePayload = {
    routeId: string;
};

export type SetRouteEditingStatePayload = {
    routingType: RoutingType;
};

export type SetOpacityAndWeightPayload = {
    opacity: number;
    weight: number;
};

export class SetRouteEditingStateAction extends BaseAction<SetRouteEditingStatePayload> {
    constructor(payload: SetRouteEditingStatePayload) {
        super(SET_ROUTING_TYPE, payload);
    }
}

export class SetSelectedRouteAction extends BaseAction<RoutePayload> {
    constructor(payload: RoutePayload) {
        super(SET_SELECTED_ROUTE, payload);
    }
}

export class SetOpacityAndWeightAction extends BaseAction<SetOpacityAndWeightPayload> {
    constructor(payload: SetOpacityAndWeightPayload) {
        super(SET_OPACITY_AND_WEIGHT, payload);
    }
}

class RouteEditingReducer {
    @ReduxAction(SET_ROUTING_TYPE)
    public setRoutingType(lastState: RouteEditingState, action: SetRouteEditingStateAction): RouteEditingState {
        return {
            ...lastState,
            routingType: action.payload.routingType
        };
    }

    @ReduxAction(SET_SELECTED_ROUTE)
    public setSelectedRoute(lastState: RouteEditingState, action: SetSelectedRouteAction): RouteEditingState {
        return {
            ...lastState,
            selectedRouteId: action.payload.routeId
        };
    }

    @ReduxAction(SET_OPACITY_AND_WEIGHT)
    public setOpacityAndWeight(lastState: RouteEditingState, action: SetOpacityAndWeightAction): RouteEditingState {
        return {
            ...lastState,
            opacity: action.payload.opacity,
            weight: action.payload.weight
        };
    }
}

export const routeEditingReducer = createReducerFromClass(RouteEditingReducer, initialState.routeEditingState);
