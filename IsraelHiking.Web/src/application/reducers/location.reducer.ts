import { Action, AbstractReducer, ReducerActions } from "@angular-redux2/store";

import type { LocationState } from "../models/models";

export type SetLocationPayload = {
    longitude: number;
    latitude: number;
    zoom?: number;
};

export class LocationReducer extends AbstractReducer {
    static actions: ReducerActions<LocationReducer>;

    @Action
    public setLocation(lastState: LocationState, payload: SetLocationPayload) {
        return {
            zoom: payload.zoom || lastState.zoom,
            longitude: payload.longitude || lastState.longitude,
            latitude: payload.latitude || lastState.latitude
        };
    }        
}
