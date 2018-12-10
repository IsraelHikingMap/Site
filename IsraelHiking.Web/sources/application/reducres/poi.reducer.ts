import { createReducerFromClass, ReduxAction, BaseAction } from "./reducer-action-decorator";
import { initialState } from "./initial-state";
import { PointsOfInterestState, PointOfInterestExtended, MarkerData } from "../models/models";

const SET_SELECTED_POI = "SET_SELECTED_POI";
const SET_UPLOAD_MARKER_DATA = "SET_UPLOAD_MARKER_DATA";

export interface SetSelectedPoiPayload {
    poi: PointOfInterestExtended;
}

export interface SetUploadMarkerDataPayload {
    markerData: MarkerData;
}

export class SetSelectedPoiAction extends BaseAction<SetSelectedPoiPayload> {
    constructor(payload: SetSelectedPoiPayload) {
        super(SET_SELECTED_POI, payload);
    }
}

export class SetUploadMarkerDataAction extends BaseAction<SetUploadMarkerDataPayload> {
    constructor(payload: SetUploadMarkerDataPayload) {
        super(SET_UPLOAD_MARKER_DATA, payload);
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

    @ReduxAction(SET_UPLOAD_MARKER_DATA)
    public setUploadMarkerData(lastState: PointsOfInterestState, action: SetUploadMarkerDataAction) {
        return {
            ...lastState,
            uploadMarkerData: action.payload.markerData
        };
    }
}

export const pointsOfInterestReducer = createReducerFromClass(PointsOfInterestReducer, initialState.poiState);