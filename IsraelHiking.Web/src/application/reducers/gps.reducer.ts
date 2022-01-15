import { Action as ReduxAction, createReducerFromClass } from "@angular-redux2/store";

import type { GpsState, TrackingStateType } from "../models/models";
import { initialState, BaseAction } from "./initial-state";

const SET_TRAKING_STATE = "SET_TRAKING_STATE";
const SET_CURRENT_LOCATION = "SET_CURRENT_LOCATION";

export type SetTrackingStatePayload = {
    state: TrackingStateType;
};

export type SetCurrentPoistionPayload = {
    position: GeolocationPosition;
};

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
