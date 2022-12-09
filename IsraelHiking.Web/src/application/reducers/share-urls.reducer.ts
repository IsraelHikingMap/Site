import { Action, AbstractReducer } from "@angular-redux2/store";

import type { ShareUrl, ShareUrlsState } from "../models/models";
import type { ReducerActions } from "./initial-state";

export class ShareUrlPayload {
    shareUrl: ShareUrl;
}

export class ShareUrlsReducer extends AbstractReducer {
    static actions: ReducerActions<ShareUrlsReducer>;

    @Action
    public addShareUrl(lastState: ShareUrlsState, payload: ShareUrlPayload): ShareUrlsState {
        lastState.shareUrls.push(payload.shareUrl);
        return lastState;
    }

    @Action
    public removeShareUrl(lastState: ShareUrlsState, payload: ShareUrlPayload): ShareUrlsState {
        lastState.shareUrls = lastState.shareUrls.filter(s => s.id !== payload.shareUrl.id);
        return lastState;
    }

    @Action
    public updateShareUrl(lastState: ShareUrlsState, payload: ShareUrlPayload): ShareUrlsState {
        let shareUrlIndex = lastState.shareUrls.findIndex(s => s.id === payload.shareUrl.id);
        lastState.shareUrls.splice(shareUrlIndex, 1, payload.shareUrl);
        return lastState;
    }
}
