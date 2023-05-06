import { Action, AbstractReducer, ReducerActions } from "@angular-redux2/store";

import type { GpsState, TrackingStateType } from "../models/models";

export type SetTrackingStatePayload = {
    state: TrackingStateType;
};

export type SetCurrentPositionPayload = {
    position: GeolocationPosition;
};

export class GpsReducer extends AbstractReducer {
    static actions: ReducerActions<GpsReducer>;

    @Action
    public setTrackingState(lastState: GpsState, payload: SetTrackingStatePayload): GpsState {
        lastState.tracking = payload.state;
        return lastState;
    }

    @Action
    public setCurrentPosition(lastState: GpsState, payload: SetCurrentPositionPayload): GpsState {
        // Clone position before setting into state since this object can't be cloned regularly
        let currentPoistion = payload.position == null ? null : {
            coords: {
                accuracy: payload.position.coords.accuracy,
                altitude: payload.position.coords.altitude,
                latitude: payload.position.coords.latitude,
                longitude: payload.position.coords.longitude,
                speed: payload.position.coords.speed,
                heading: payload.position.coords.heading
            },
            timestamp: payload.position.timestamp
        } as GeolocationPosition;
        lastState.currentPoistion = currentPoistion;
        return lastState;
    }
}
