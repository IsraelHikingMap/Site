import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

import type { ShareUrl, ShareUrlsState } from "../models/models";

export class ShareUrlPayload {
    shareUrl: ShareUrl;
}

export class ShareUrlsReducer extends AbstractReducer {
    static actions: {
        addShareUrl: ActionPayload<ShareUrlPayload>;
        removeShareUrl: ActionPayload<ShareUrlPayload>;
        updateShareUrl: ActionPayload<ShareUrlPayload>;
    };

    @Action
    public addShareUrl(lastState: ShareUrlsState, action: AnyAction<ShareUrlPayload>): ShareUrlsState {
        lastState.shareUrls.push(action.payload.shareUrl);
        return lastState;
    }

    @Action
    public removeShareUrl(lastState: ShareUrlsState, action: AnyAction<ShareUrlPayload>): ShareUrlsState {
        lastState.shareUrls = lastState.shareUrls.filter(s => s.id !== action.payload.shareUrl.id);
        return lastState;
    }

    @Action
    public updateShareUrl(lastState: ShareUrlsState, action: AnyAction<ShareUrlPayload>): ShareUrlsState {
        let shareUrlIndex = lastState.shareUrls.findIndex(s => s.id === action.payload.shareUrl.id);
        lastState.shareUrls.splice(shareUrlIndex, 1, action.payload.shareUrl);
        return lastState;
    }
}
