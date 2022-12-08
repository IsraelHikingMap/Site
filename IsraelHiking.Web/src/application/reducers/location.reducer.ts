import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

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
    public setLocation(lastState: Location, action: AnyAction<SetLocationPayload>) {
        return {
            zoom: action.payload.zoom || lastState.zoom,
            longitude: action.payload.longitude || lastState.longitude,
            latitude: action.payload.latitude || lastState.latitude
        };
    }
}
