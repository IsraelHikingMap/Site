import { Action as ReduxAction, createReducerFromClass } from "@angular-redux2/store";

import { initialState, BaseAction } from "./initial-state";
import type { LocationState } from "../models/models";

const SET_LOCATION = "SET_LOCATION";

export type SetLocationPayload = {
    longitude: number;
    latitude: number;
    zoom?: number;
};

export class SetLocationAction extends BaseAction<SetLocationPayload> {
    constructor(payload: SetLocationPayload) {
        super(SET_LOCATION, payload);
    }
}

export class LocationReducer {
    @ReduxAction(SET_LOCATION)
    public setLocation(lastState: LocationState, action: SetLocationAction) {
        return {
            zoom: action.payload.zoom || lastState.zoom,
            longitude: action.payload.longitude || lastState.longitude,
            latitude: action.payload.latitude || lastState.latitude
        };
    }
}

export const locationReducer = createReducerFromClass(LocationReducer, initialState.location);
