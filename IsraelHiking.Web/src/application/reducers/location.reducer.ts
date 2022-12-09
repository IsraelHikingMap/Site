import { Action, AbstractReducer, ActionPayload } from "@angular-redux2/store";

import type { Location } from "../models/models";

export type SetLocationPayload = {
    longitude: number;
    latitude: number;
    zoom?: number;
};

export class LocationReducer extends AbstractReducer {
    static actions: {
        setLocation: ActionPayload<SetLocationPayload>;
    };
    @Action
    public setLocation(lastState: Location, payload: SetLocationPayload) {
        return {
            zoom: payload.zoom || lastState.zoom,
            longitude: payload.longitude || lastState.longitude,
            latitude: payload.latitude || lastState.latitude
        };
    }
}
