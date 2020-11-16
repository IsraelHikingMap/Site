import { Action } from "redux";

import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";
import { ShareUrl, InMemoryState } from "../models/models";
import { initialState } from "./initial-state";

const TOGGLE_DISTNACE = "TOGGLE_DISTNACE";
const SET_SHARE_URL = "SET_SHARE_URL";
const SET_FILE_URL_AND_BASE_LAYER = "SET_FILE_URL_AND_BASE_LAYER";

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

export class InMemoryReducer {
    @ReduxAction(TOGGLE_DISTNACE)
    public toggleDistance(lastState: InMemoryState, action: ToggleDistanceAction): InMemoryState {
        return {
            ...lastState,
            distance: !lastState.distance
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
}

export const inMemoryReducer = createReducerFromClass(InMemoryReducer, initialState.inMemoryState);
