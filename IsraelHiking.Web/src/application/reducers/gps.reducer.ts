import { BaseAction, createReducerFromClass, ReduxAction } from "./infra/ng-redux.module";
import { GpsState, TrackingStateType } from "../models/models";
import { initialState } from "./initial-state";

const SET_TRAKING_STATE = "SET_TRAKING_STATE";
const SET_CURRENT_LOCATION = "SET_CURRENT_LOCATION";

export interface SetTrackingStatePayload {
    state: TrackingStateType;
}

export interface SetCurrentPoistionPayload {
    position: GeolocationPosition;
}

export class SetTrackingStateAction extends BaseAction<SetTrackingStatePayload> {
    constructor(payload: SetTrackingStatePayload) {
        super(SET_TRAKING_STATE, payload);
    }
}

export class SetCurrentPositionAction extends BaseAction<SetCurrentPoistionPayload> {
    constructor(payload: SetCurrentPoistionPayload) {
        super(SET_CURRENT_LOCATION, payload);
    }
}

export class GpsReducer {
    @ReduxAction(SET_TRAKING_STATE)
    public setTrackingState(lastState: GpsState, action: SetTrackingStateAction): GpsState {
        return {
            ...lastState,
            tracking: action.payload.state
        };
    }

    @ReduxAction(SET_CURRENT_LOCATION)
    public setCurrentPosition(lastState: GpsState, action: SetCurrentPositionAction): GpsState {
        return {
            ...lastState,
            currentPoistion: action.payload.position
        };
    }
}

export const gpsReducer = createReducerFromClass(GpsReducer, initialState.gpsState);
