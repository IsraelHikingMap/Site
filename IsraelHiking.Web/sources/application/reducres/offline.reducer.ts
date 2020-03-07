import { OfflineState } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, BaseAction, createReducerFromClass } from "./reducer-action-decorator";

const SET_OFFLINE_AVAILABLE = "SET_OFFLINE_AVAILABLE";
const SET_OFFLINE_LAST_MODIFIED_DATE = "SET_OFFLINE_LAST_MODIFIED_DATE";

export interface SetOfflineAvailablePayload {
    isAvailble: boolean;
}

export interface SetOfflineLastModifiedPayload {
    lastModifiedDate: Date;
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
}

export const offlineReducer = createReducerFromClass(OfflineReducer, initialState.offlineState);
