import { Action, AbstractReducer, ActionsReducer } from "@angular-redux2/store";

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
    static actions: ActionsReducer<OfflineReducer>;

    @Action
    public setOfflineAvailable(lastState: OfflineState, payload: SetOfflineAvailablePayload): OfflineState {
        lastState.isOfflineAvailable = payload.isAvailble;
        return lastState;
    }

    @Action
    public setLastModifed(lastState: OfflineState, payload: SetLastModifiedPayload): OfflineState {
        lastState.lastModifiedDate = payload.lastModifiedDate;
        return lastState;
    }

    @Action
    public setPoisLastModifed(lastState: OfflineState, payload: SetLastModifiedPayload): OfflineState {
        lastState.poisLastModifiedDate = payload.lastModifiedDate;
        return lastState;
    }

    @Action
    public setShareUrlsLastModified(lastState: OfflineState, payload: SetLastModifiedPayload): OfflineState {
        lastState.shareUrlsLastModifiedDate = payload.lastModifiedDate;
        return lastState;
    }

    @Action
    public addToPoiQueue(lastState: OfflineState, payload: PoiQueuePayload): OfflineState {
        lastState.uploadPoiQueue.push(payload.featureId);
        return lastState;
    }

    @Action
    public removeFromPoiQueue(lastState: OfflineState, payload: PoiQueuePayload): OfflineState {
        lastState.uploadPoiQueue = lastState.uploadPoiQueue.filter(f => f !== payload.featureId);
        return lastState;
    }
}
