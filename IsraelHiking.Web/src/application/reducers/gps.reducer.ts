import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { GpsState, TrackingStateType } from "../models";

export class SetTrackingStateAction {
    public static type = this.prototype.constructor.name;
    constructor(public state: TrackingStateType) {}
}

export class SetCurrentPositionAction {
    public static type = this.prototype.constructor.name;
    constructor(public position: GeolocationPosition) {}
}
@State<GpsState>({
    name: "gpsState",
    defaults: initialState.gpsState
})
@Injectable()
export class GpsReducer {

    @Action(SetTrackingStateAction)
    public setTrackingState(ctx: StateContext<GpsState>, action: SetTrackingStateAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.tracking = action.state;
            return lastState;
        }));
    }

    @Action(SetCurrentPositionAction)
    public setCurrentPosition(ctx: StateContext<GpsState>, action: SetCurrentPositionAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
        // Clone position before setting into state since this object can't be cloned regularly
            const currentPosition = action.position == null ? null : {
                coords: {
                    accuracy: action.position.coords.accuracy,
                    altitude: action.position.coords.altitude,
                    latitude: action.position.coords.latitude,
                    longitude: action.position.coords.longitude,
                    speed: action.position.coords.speed,
                    heading: action.position.coords.heading
                },
                timestamp: action.position.timestamp
            } as GeolocationPosition;
            lastState.currentPosition = currentPosition;
            return lastState;
        }));
    }
}
