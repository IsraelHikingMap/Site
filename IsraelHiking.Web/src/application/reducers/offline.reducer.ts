import { initialState } from "./initial-state";
import { ReduxAction, BaseAction, createReducerFromClass } from "./infra/ng-redux.module";
import type { OfflineState } from "../models/models";

const SET_OFFLINE_AVAILABLE = "SET_OFFLINE_AVAILABLE";
const SET_OFFLINE_LAST_MODIFIED_DATE = "SET_OFFLINE_LAST_MODIFIED_DATE";
const SET_OFFLINE_POIS_LAST_MODIFIED_DATE = "SET_OFFLINE_POIS_LAST_MODIFIED_DATE";
const SET_SHARE_URLS_LAST_MODIFIED_DATE = "SET_SHARE_URLS_LAST_MODIFIED_DATE";
const ADD_TO_POI_QUEUE = "ADD_TO_POI_QUEUE";
const REMOVE_FROM_POI_QUEUE = "REMOVE_FROM_POI_QUEUE";

export type SetOfflineAvailablePayload = {
    isAvailble: boolean;
}

export type SetOfflineLastModifiedPayload = {
    lastModifiedDate: Date;
}

export type SetShareUrlsLastModifiedPayload = {
    lastModifiedDate: Date;
}

export type AddToPoiQueuePayload = {
    featureId: string;
}

export type RemoveFromPoiQueuePayload = {
    featureId: string;
}

export class SetOfflineAvailableAction extends BaseAction<SetOfflineAvailablePayload> {
    constructor(payload: SetOfflineAvailablePayload) {
        super(SET_OFFLINE_AVAILABLE, payload);
    }
}

export class SetOfflineLastModifiedAction extends BaseAction<SetOfflineLastModifiedPayload> {
    constructor(payload: SetOfflineLastModifiedPayload) {
        super(SET_OFFLINE_LAST_MODIFIED_DATE, payload);
    }
}

export class SetOfflinePoisLastModifiedDateAction extends BaseAction<SetOfflineLastModifiedPayload> {
    constructor(payload: SetOfflineLastModifiedPayload) {
        super(SET_OFFLINE_POIS_LAST_MODIFIED_DATE, payload);
    }
}

export class SetShareUrlsLastModifiedDateAction extends BaseAction<SetShareUrlsLastModifiedPayload> {
    constructor(payload: SetShareUrlsLastModifiedPayload) {
        super(SET_SHARE_URLS_LAST_MODIFIED_DATE, payload);
    }
}

export class AddToPoiQueueAction extends BaseAction<AddToPoiQueuePayload> {
    constructor(payload: AddToPoiQueuePayload) {
        super(ADD_TO_POI_QUEUE, payload);
    }
}

export class RemoveFromPoiQueueAction extends BaseAction<RemoveFromPoiQueuePayload> {
    constructor(payload: RemoveFromPoiQueuePayload) {
        super(REMOVE_FROM_POI_QUEUE, payload);
    }
}

export class OfflineReducer {
    @ReduxAction(SET_OFFLINE_AVAILABLE)
    public setOfflineAvailable(lastState: OfflineState, action: SetOfflineAvailableAction): OfflineState {
        return {
            ...lastState,
            isOfflineAvailable: action.payload.isAvailble
        };
    }

    @ReduxAction(SET_OFFLINE_LAST_MODIFIED_DATE)
    public setLastModifed(lastState: OfflineState, action: SetOfflineLastModifiedAction): OfflineState {
        return {
            ...lastState,
            lastModifiedDate: action.payload.lastModifiedDate
        };
    }

    @ReduxAction(SET_OFFLINE_POIS_LAST_MODIFIED_DATE)
    public setPoisLastModifed(lastState: OfflineState, action: SetOfflineLastModifiedAction): OfflineState {
        return {
            ...lastState,
            poisLastModifiedDate: action.payload.lastModifiedDate
        };
    }

    @ReduxAction(SET_SHARE_URLS_LAST_MODIFIED_DATE)
    public setShareUrlsLastModified(lastState: OfflineState, action: SetShareUrlsLastModifiedDateAction): OfflineState {
        return {
            ...lastState,
            shareUrlsLastModifiedDate: action.payload.lastModifiedDate
        };
    }

    @ReduxAction(ADD_TO_POI_QUEUE)
    public addToPoiQueue(lastState: OfflineState, action: AddToPoiQueueAction): OfflineState {
        return {
            ...lastState,
            uploadPoiQueue: [...lastState.uploadPoiQueue, action.payload.featureId]
        };
    }

    @ReduxAction(REMOVE_FROM_POI_QUEUE)
    public removeFromPoiQueue(lastState: OfflineState, action: RemoveFromPoiQueueAction): OfflineState {
        return {
            ...lastState,
            uploadPoiQueue: lastState.uploadPoiQueue.filter(f => f !== action.payload.featureId)
        };
    }
}

export const offlineReducer = createReducerFromClass(OfflineReducer, initialState.offlineState);
