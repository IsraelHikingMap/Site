import { createReducerFromClass, Action as ReduxAction } from "@angular-redux2/store";

import { initialState, BaseAction } from "./initial-state";
import type { PointsOfInterestState, MarkerData } from "../models/models";

const SET_SELECTED_POI = "SET_SELECTED_POI";
const SET_UPLOAD_MARKER_DATA = "SET_UPLOAD_MARKER_DATA";
const SET_SIDEBAR = "SET_SIDEBAR";

export type SetSelectedPoiPayload = {
    poi: GeoJSON.Feature;
};

export type SetUploadMarkerDataPayload = {
    markerData: MarkerData;
};

export type SetSidebarPayload = {
    isOpen: boolean;
};

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

export class SetSidebarAction extends BaseAction<SetSidebarPayload> {
    constructor(payload: SetSidebarPayload) {
        super(SET_SIDEBAR, payload);
    }
}

export class PointsOfInterestReducer {
    @ReduxAction(SET_SELECTED_POI)
    public setSelectedPoi(lastState: PointsOfInterestState, action: SetSelectedPoiAction): PointsOfInterestState {
        return {
            ...lastState,
            selectedPointOfInterest: action.payload.poi
        };
    }

    @ReduxAction(SET_UPLOAD_MARKER_DATA)
    public setUploadMarkerData(lastState: PointsOfInterestState, action: SetUploadMarkerDataAction): PointsOfInterestState {
        return {
            ...lastState,
            uploadMarkerData: action.payload.markerData
        };
    }

    @ReduxAction(SET_SIDEBAR)
    public setSidebar(lastState: PointsOfInterestState, action: SetSidebarAction): PointsOfInterestState {
        return {
            ...lastState,
            isSidebarOpen: action.payload.isOpen
        };
    }
}

export const pointsOfInterestReducer = createReducerFromClass(PointsOfInterestReducer, initialState.poiState);
