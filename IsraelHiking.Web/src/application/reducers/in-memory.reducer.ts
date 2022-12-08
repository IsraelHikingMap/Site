import { Action, AbstractReducer, ActionPayload, AnyAction } from "@angular-redux2/store";

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
    static actions: {
        toggleDistance: ActionPayload<void>;
        setFollowing: ActionPayload<SetFollowingPayload>;
        setPanned: ActionPayload<SetPannedPayload>;
        setShareUrl: ActionPayload<SetShareUrlPayload>;
        setFileUrlAndBaseLayer: ActionPayload<SetFileUrlAndBaseLayerPayload>;
    };

    @Action
    public toggleDistance(lastState: InMemoryState, _action: AnyAction<void>): InMemoryState {
        lastState.distance = !lastState.distance;
        return lastState;
    }

    @Action
    public setFollowing(lastState: InMemoryState, action: AnyAction<SetFollowingPayload>): InMemoryState {
        lastState.following = action.payload.following;
        return lastState;
    }

    @Action
    public setPanned(lastState: InMemoryState, action: AnyAction<SetPannedPayload>): InMemoryState {
        lastState.pannedTimestamp = action.payload.pannedTimestamp;
        return lastState;
    }

    @Action
    public setShareUrl(lastState: InMemoryState, action: AnyAction<SetShareUrlPayload>): InMemoryState {
        lastState.shareUrl = action.payload.shareUrl;
        return lastState;
    }

    @Action
    public setFileUrlAndBaseLayer(lastState: InMemoryState, action: AnyAction<SetFileUrlAndBaseLayerPayload>): InMemoryState {
        lastState.fileUrl = action.payload.fileUrl;
        lastState.baseLayer = action.payload.baseLayer;
        return lastState;
    }
}
