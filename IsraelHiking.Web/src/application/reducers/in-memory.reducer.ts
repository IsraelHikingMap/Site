import { Action } from "redux";

import { ReduxAction, BaseAction, createReducerFromClass } from "./infra/ng-redux.module";
import { ShareUrl, InMemoryState, GeoLocationStateType } from "../models/models";
import { initialState } from "./initial-state";

const TOGGLE_DISTNACE = "TOGGLE_DISTNACE";
const SET_PANNED = "SET_PANNED";
const SET_SHARE_URL = "SET_SHARE_URL";
const SET_FILE_URL_AND_BASE_LAYER = "SET_FILE_URL_AND_BASE_LAYER";
const SET_GEO_LOCATION = "SET_GEO_LOCATION";

export interface SetPannedPayload {
    pannedTimestamp: Date;
}

export interface SetShareUrlPayload {
    shareUrl: ShareUrl;
}

export interface SetFileUrlAndBaseLayerPayload {
    fileUrl: string;
    baseLayer: string;
}

export class ToggleDistanceAction implements Action {
    public type: string;
    constructor() {
        this.type = TOGGLE_DISTNACE;
    }
}

export interface SetGeoLocationPayload {
    state: GeoLocationStateType;
}

export class SetPannedAction extends BaseAction<SetPannedPayload> {
    constructor(payload: SetPannedPayload) {
        super(SET_PANNED, payload);
    }
}

export class SetShareUrlAction extends BaseAction<SetShareUrlPayload> {
    constructor(payload: SetShareUrlPayload) {
        super(SET_SHARE_URL, payload);
    }
}

export class SetFileUrlAndBaseLayerAction extends BaseAction<SetFileUrlAndBaseLayerPayload> {
    constructor(payload: SetFileUrlAndBaseLayerPayload) {
        super(SET_FILE_URL_AND_BASE_LAYER, payload);
    }
}

export class SetGeoLocationStateAction extends BaseAction<SetGeoLocationPayload> {
    constructor(payload: SetGeoLocationPayload) {
        super(SET_GEO_LOCATION, payload);
    }
}

export class InMemoryReducer {
    @ReduxAction(TOGGLE_DISTNACE)
    public toggleDistance(lastState: InMemoryState, action: ToggleDistanceAction): InMemoryState {
        return {
            ...lastState,
            distance: !lastState.distance
        };
    }

    @ReduxAction(SET_PANNED)
    public setPanned(lastState: InMemoryState, action: SetPannedAction): InMemoryState {
        return {
            ...lastState,
            pannedTimestamp: action.payload.pannedTimestamp
        };
    }

    @ReduxAction(SET_SHARE_URL)
    public setShareUrl(lastState: InMemoryState, action: SetShareUrlAction): InMemoryState {
        return {
            ...lastState,
            shareUrl: action.payload.shareUrl
        };
    }

    @ReduxAction(SET_FILE_URL_AND_BASE_LAYER)
    public setFileUrl(lastState: InMemoryState, action: SetFileUrlAndBaseLayerAction): InMemoryState {
        return {
            ...lastState,
            fileUrl: action.payload.fileUrl,
            baseLayer: action.payload.baseLayer
        };
    }

    @ReduxAction(SET_GEO_LOCATION)
    public setGeoLocationState(lastState: InMemoryState, action: SetGeoLocationStateAction): InMemoryState {
        return {
            ...lastState,
            geoLocation: action.payload.state
        };
    }
}

export const inMemoryReducer = createReducerFromClass(InMemoryReducer, initialState.inMemoryState);
