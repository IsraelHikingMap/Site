import { ReduxAction, BaseAction, createReducerFromClass } from "@angular-redux2/store";

import { initialState } from "./initial-state";
import type { Location } from "../models/models";

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
    public setLocation(lastState: Location, action: SetLocationAction) {
        return {
            zoom: action.payload.zoom || lastState.zoom,
            longitude: action.payload.longitude || lastState.longitude,
            latitude: action.payload.latitude || lastState.latitude
        };
    }
}

export const locationReducer = createReducerFromClass(LocationReducer, initialState.location);
