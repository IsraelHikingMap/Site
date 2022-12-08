import { Action, AbstractReducer, ActionPayload, AnyAction } from "@angular-redux2/store";

import type { GpsState, TrackingStateType } from "../models/models";

export type SetTrackingStatePayload = {
    state: TrackingStateType;
};

export type SetCurrentPositionPayload = {
    position: GeolocationPosition;
};

export class GpsReducer extends AbstractReducer {
    static actions: {
        setTrackingState: ActionPayload<SetTrackingStatePayload>;
        setCurrentPosition: ActionPayload<SetCurrentPositionPayload>;
    };

    @Action
    public setTrackingState(lastState: GpsState, action: AnyAction<SetTrackingStatePayload>): GpsState {
        lastState.tracking = action.payload.state;
        return lastState;
    }

    @Action
    public setCurrentPosition(lastState: GpsState, action: AnyAction<SetCurrentPositionPayload>): GpsState {
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
        lastState.currentPoistion = currentPoistion;
        return lastState;
    }
}
