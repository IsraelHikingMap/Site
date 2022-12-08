import { Action, AbstractReducer, ActionPayload, AnyAction } from "@angular-redux2/store";

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
    static actions: {
        setSelectedRoute: ActionPayload<RoutePayload>;
        setRoutingType: ActionPayload<SetRoutingTypePayload>;
        setOpacityAndWeight: ActionPayload<SetOpacityAndWeightPayload>;
    };

    @Action
    public setSelectedRoute(lastState: RouteEditingState, action: AnyAction<RoutePayload>): RouteEditingState {
        lastState.selectedRouteId = action.payload.routeId;
        return lastState;
    }

    @Action
    public setRoutingType(lastState: RouteEditingState, action: AnyAction<SetRoutingTypePayload>): RouteEditingState {
        lastState.routingType = action.payload.routingType;
        return lastState;
    }

    @Action
    public setOpacityAndWeight(lastState: RouteEditingState, action: AnyAction<SetOpacityAndWeightPayload>): RouteEditingState {
        lastState.opacity = action.payload.opacity;
        lastState.weight = action.payload.weight;
        return lastState;
    }
}
