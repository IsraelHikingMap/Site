import { Action } from "redux";

import { ReduxAction, BaseAction, createReducerFromClass } from "./infra/ng-redux.module";
import { initialState } from "./initial-state";
import type { RoutingType, RouteEditingState } from "../models/models";

const SET_ROUTING_TYPE = "SET_ROUTING_TYPE";
const SET_SELECTED_ROUTE = "SET_SELECTED_ROUTE";
const START_RECORDING = "START_RECORDING";
const STOP_RECORDING = "STOP_RECORDING";
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

export class StartRecordingAction extends BaseAction<RoutePayload> {
    constructor(payload: RoutePayload) {
        super(START_RECORDING, payload);
    }
}

export class StopRecordingAction implements Action {
    constructor(public type = STOP_RECORDING) {}
}

export class SetOpacityAndWeightAction extends BaseAction<SetOpacityAndWeightPayload> {
    constructor(payload: SetOpacityAndWeightPayload) {
        super(SET_OPACITY_AND_WEIGHT, payload);
    }
}

class RouteEditingStateReducer {
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

    @ReduxAction(START_RECORDING)
    public startRecording(lastState: RouteEditingState, action: StartRecordingAction): RouteEditingState {
        return {
            ...lastState,
            recordingRouteId: action.payload.routeId
        };
    }

    @ReduxAction(STOP_RECORDING)
    public stopRecording(lastState: RouteEditingState, _: StopRecordingAction): RouteEditingState {
        return {
            ...lastState,
            recordingRouteId: null
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

export const routeEditingReducer = createReducerFromClass(RouteEditingStateReducer, initialState.routeEditingState);
