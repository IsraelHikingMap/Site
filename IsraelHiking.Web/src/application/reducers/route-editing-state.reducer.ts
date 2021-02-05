import { RoutingType, RouteEditingState } from "../models/models";
import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";
import { initialState } from "./initial-state";

const SET_ROUTING_TYPE = "SET_ROUTING_TYPE";
const SET_SELECTED_ROUTE = "SET_SELECTED_ROUTE";
const START_RECORDING = "START_RECORDING";
const STOP_RECORDING = "STOP_RECORDING";
const SET_OPACITY_AND_WEIGHT = "SET_OPACITY_AND_WEIGHT";

export interface RoutePayload {
    routeId: string;
}

export interface SetRouteEditingStatePayload {
    routingType: RoutingType;
}

export interface SetOpacityAndWeightPayload {
    opacity: number;
    weight: number;
}

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

export class StopRecordingAction extends BaseAction<{}> {
    constructor(payload: {}) {
        super(STOP_RECORDING, payload);
    }
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
    public stopRecording(lastState: RouteEditingState, action: StopRecordingAction): RouteEditingState {
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
