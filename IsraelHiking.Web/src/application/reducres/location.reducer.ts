import { Location } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";

const SET_LOCATION = "SET_LOCATION";

export interface SetLocationPayload {
    longitude: number;
    latitude: number;
    zoom?: number;
}

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
