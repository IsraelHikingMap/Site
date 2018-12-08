import { createReducerFromClass, ReduxAction, BaseAction } from "./reducer-action-decorator";
import { initialState } from "./initial-state";
import { PointsOfInterestState, PointOfInterestExtended } from "../models/models";

const SET_SELECTED_POI = "SET_SELECTED_POI";

export interface SetSelectedPoiPayload {
    poi: PointOfInterestExtended;
}

export class SetSelectedPoiAction extends BaseAction<SetSelectedPoiPayload> {
    constructor(payload: SetSelectedPoiPayload) {
        super(SET_SELECTED_POI, payload);
    }
}


export class PointsOfInterestReducer {
    @ReduxAction(SET_SELECTED_POI)
    public setSelectedPoi(lastState: PointsOfInterestState, action: SetSelectedPoiAction) {
        return {
            ...lastState,
            selectedPointOfInterest: action.payload.poi
        };
    }
}

export const pointsOfInterestReducer = createReducerFromClass(PointsOfInterestReducer, initialState.poiState);