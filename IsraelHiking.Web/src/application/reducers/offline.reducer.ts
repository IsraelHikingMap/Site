import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

import type { OfflineState } from "../models/models";

export type SetOfflineAvailablePayload = {
    isAvailble: boolean;
};

export type SetLastModifiedPayload = {
    lastModifiedDate: Date;
};

export type PoiQueuePayload = {
    featureId: string;
};


export class OfflineReducer extends AbstractReducer {
    static actions: {
        setOfflineAvailable: ActionPayload<SetOfflineAvailablePayload>;
        setLastModifed: ActionPayload<SetLastModifiedPayload>;
        setPoisLastModifed: ActionPayload<SetLastModifiedPayload>;
        setShareUrlsLastModified: ActionPayload<SetLastModifiedPayload>;
        addToPoiQueue: ActionPayload<PoiQueuePayload>;
        removeFromPoiQueue: ActionPayload<PoiQueuePayload>;

    };
    @Action
    public setOfflineAvailable(lastState: OfflineState, action: AnyAction<SetOfflineAvailablePayload>): OfflineState {
        lastState.isOfflineAvailable = action.payload.isAvailble;
        return lastState;
    }

    @Action
    public setLastModifed(lastState: OfflineState, action: AnyAction<SetLastModifiedPayload>): OfflineState {
        lastState.lastModifiedDate = action.payload.lastModifiedDate;
        return lastState;
    }

    @Action
    public setPoisLastModifed(lastState: OfflineState, action: AnyAction<SetLastModifiedPayload>): OfflineState {
        lastState.poisLastModifiedDate = action.payload.lastModifiedDate;
        return lastState;
    }

    @Action
    public setShareUrlsLastModified(lastState: OfflineState, action: AnyAction<SetLastModifiedPayload>): OfflineState {
        lastState.shareUrlsLastModifiedDate = action.payload.lastModifiedDate;
        return lastState;
    }

    @Action
    public addToPoiQueue(lastState: OfflineState, action: AnyAction<PoiQueuePayload>): OfflineState {
        lastState.uploadPoiQueue.push(action.payload.featureId);
        return lastState;
    }

    @Action
    public removeFromPoiQueue(lastState: OfflineState, action: AnyAction<PoiQueuePayload>): OfflineState {
        lastState.uploadPoiQueue = lastState.uploadPoiQueue.filter(f => f !== action.payload.featureId);
        return lastState;
    }
}
