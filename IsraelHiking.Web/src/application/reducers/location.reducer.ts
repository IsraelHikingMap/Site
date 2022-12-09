import { Action, AbstractReducer } from "@angular-redux2/store";

import type { Location } from "../models/models";
import type { ReducerActions } from "./initial-state";

export type SetLocationPayload = {
    longitude: number;
    latitude: number;
    zoom?: number;
};

export class LocationReducer extends AbstractReducer {
    static actions: ReducerActions<LocationReducer>;

    @Action
    public setLocation(lastState: Location, payload: SetLocationPayload) {
        return {
            zoom: payload.zoom || lastState.zoom,
            longitude: payload.longitude || lastState.longitude,
            latitude: payload.latitude || lastState.latitude
        };
    }
}
