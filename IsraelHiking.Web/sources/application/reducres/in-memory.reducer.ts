import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";

import { ShareUrl, InMemoryState } from "../models/models";
import { initialState } from "./initial-state";

const SET_DOWNLOAD = "SET_DOWNLOAD";
const SET_SHARE_URL = "SET_SHARE_URL";
const SET_FILE_URL_AND_BASE_LAYER = "SET_FILE_URL_AND_BASE_LAYER";

export interface SetDownloadPayload {
    download: boolean;
}

export interface SetShareUrlPayload {
    shareUrl: ShareUrl;
}

export interface SetFileUrlAndBaseLayerPayload {
    fileUrl: string;
    baseLayer: string;
}

export class SetDownloadAction extends BaseAction<SetDownloadPayload> {
    constructor(payload: SetDownloadPayload) {
        super(SET_DOWNLOAD, payload);
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
    @ReduxAction(SET_DOWNLOAD)
    public setDownload(lastState: InMemoryState, action: SetDownloadAction): InMemoryState {
        return {
            ...lastState,
            download: action.payload.download
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
