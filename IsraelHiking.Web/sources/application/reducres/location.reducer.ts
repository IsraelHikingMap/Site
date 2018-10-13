import { Action, AnyAction, Reducer } from "redux";
import { Location } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";

const ZOOM_IN = "ZOOM_IN";
const ZOOM_OUT = "ZOOM_OUT";
const SET_LOCATION = "SET_LOCATION";

export interface SetLocationPayload {
    longitude: number;
    latitude: number;
    zoom?: number;
}

export class LocationActions {
    public static readonly zoomInAction: Action = {
        type: ZOOM_IN
    };

    public static readonly zoomOutAction: Action = {
        type: ZOOM_OUT
    };
}

export class SetLocationAction extends BaseAction<SetLocationPayload> {
    constructor(payload: SetLocationPayload) {
        super(SET_LOCATION, payload);
    }
}

export class LocationReducer {
    @ReduxAction(ZOOM_IN)
    public zoomIn(lastState: Location, action: Action) {
        return {
            ...lastState,
            zoom: lastState.zoom + 1,
        };
    }

    @ReduxAction(ZOOM_OUT)
    public zoomOut(lastState: Location, action: Action) {
        return {
            ...lastState,
            zoom: lastState.zoom - 1,
        };
    }

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