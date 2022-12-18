import { Action, AbstractReducer, ActionsReducer } from "@angular-redux2/store";

import type { ShareUrl, InMemoryState } from "../models/models";

export type SetFollowingPayload = {
    following: boolean;
};

export type SetPannedPayload = {
    pannedTimestamp: Date;
};

export type SetShareUrlPayload = {
    shareUrl: ShareUrl;
};

export type SetFileUrlAndBaseLayerPayload = {
    fileUrl: string;
    baseLayer: string;
};

export class InMemoryReducer extends AbstractReducer {
    static actions: ActionsReducer<InMemoryReducer>;

    @Action
    public toggleDistance(lastState: InMemoryState): InMemoryState {
        lastState.distance = !lastState.distance;
        return lastState;
    }

    @Action
    public setFollowing(lastState: InMemoryState, payload: SetFollowingPayload): InMemoryState {
        lastState.following = payload.following;
        return lastState;
    }

    @Action
    public setPanned(lastState: InMemoryState, payload: SetPannedPayload): InMemoryState {
        lastState.pannedTimestamp = payload.pannedTimestamp;
        return lastState;
    }

    @Action
    public setShareUrl(lastState: InMemoryState, payload: SetShareUrlPayload): InMemoryState {
        lastState.shareUrl = payload.shareUrl;
        return lastState;
    }

    @Action
    public setFileUrlAndBaseLayer(lastState: InMemoryState, payload: SetFileUrlAndBaseLayerPayload): InMemoryState {
        lastState.fileUrl = payload.fileUrl;
        lastState.baseLayer = payload.baseLayer;
        return lastState;
    }
}
