import { BaseAction, ReduxAction, createReducerFromClass } from "./infra/ng-redux.module";
import { initialState } from "./initial-state";
import type { ShareUrl, ShareUrlsState } from "../models/models";

const ADD_SHARE_URL = "ADD_SHARE_URL";
const REMOVE_SHARE_URL = "REMOVED_SHARE_URL";
const UPDATE_SHARE_URL = "UPDATE_SHARE_URL";

export class AddShareUrlPayload {
    shareUrl: ShareUrl;
}

export class RemoveShareUrlPayload {
    shareUrl: ShareUrl;
}

export class UpdateShareUrlPayload {
    shareUrl: ShareUrl;
}

export class AddShareUrlAction extends BaseAction<AddShareUrlPayload> {
    constructor(payload: AddShareUrlPayload) {
        super(ADD_SHARE_URL, payload);
    }
}

export class RemoveShareUrlAction extends BaseAction<RemoveShareUrlPayload> {
    constructor(payload: RemoveShareUrlPayload) {
        super(REMOVE_SHARE_URL, payload);
    }
}

export class UpdateShareUrlAction extends BaseAction<UpdateShareUrlPayload> {
    constructor(payload: UpdateShareUrlPayload) {
        super(UPDATE_SHARE_URL, payload);
    }
}

export class ShareUrlsReducer {
    @ReduxAction(ADD_SHARE_URL)
    public addShareUrl(lastState: ShareUrlsState, action: AddShareUrlAction): ShareUrlsState {
        return {
            shareUrls: [...lastState.shareUrls, action.payload.shareUrl]
        };
    }

    @ReduxAction(REMOVE_SHARE_URL)
    public removeShareUrl(lastState: ShareUrlsState, action: RemoveShareUrlAction): ShareUrlsState {
        return {
            shareUrls: lastState.shareUrls.filter(s => s.id !== action.payload.shareUrl.id)
        };
    }

    @ReduxAction(UPDATE_SHARE_URL)
    public updateShareUrl(lastState: ShareUrlsState, action: UpdateShareUrlAction): ShareUrlsState {
        let shareUrlIndex = lastState.shareUrls.findIndex(s => s.id === action.payload.shareUrl.id);
        let shareUrls = [...lastState.shareUrls];
        shareUrls.splice(shareUrlIndex, 1, action.payload.shareUrl);
        return {
            shareUrls
        };
    }
}

export const shareUrlsReducer = createReducerFromClass(ShareUrlsReducer, initialState.shareUrlsState);
