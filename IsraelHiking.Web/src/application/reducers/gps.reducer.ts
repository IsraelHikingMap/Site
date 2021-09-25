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
        // Clone position before setting into state since this object can't be cloned regularly
        let currentPoistion = action.payload.position == null ? null : {
            coords: {
                accuracy: action.payload.position.coords.accuracy,
                altitude: action.payload.position.coords.altitude,
                latitude: action.payload.position.coords.latitude,
                longitude: action.payload.position.coords.longitude,
                speed: action.payload.position.coords.speed,
                heading: action.payload.position.coords.heading
            },
            timestamp: action.payload.position.timestamp
        } as GeolocationPosition;
        return {
            ...lastState,
            currentPoistion
        };
    }
}

export const gpsReducer = createReducerFromClass(GpsReducer, initialState.gpsState);
