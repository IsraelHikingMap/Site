import { Action, AbstractReducer } from "@angular-redux2/store";

import type { PointsOfInterestState, MarkerData } from "../models/models";
import type { ReducerActions } from "./initial-state";


export type SetSelectedPoiPayload = {
    poi: GeoJSON.Feature;
};

export type SetUploadMarkerDataPayload = {
    markerData: MarkerData;
};

export type SetSidebarPayload = {
    isOpen: boolean;
};

export class PointsOfInterestReducer extends AbstractReducer {
    static actions: ReducerActions<PointsOfInterestReducer>;

    @Action
    public setSelectedPoi(lastState: PointsOfInterestState, payload: SetSelectedPoiPayload): PointsOfInterestState {
        lastState.selectedPointOfInterest = payload.poi;
        return lastState;
    }

    @Action
    public setUploadMarkerData(lastState: PointsOfInterestState, payload: SetUploadMarkerDataPayload): PointsOfInterestState {
        lastState.uploadMarkerData = payload.markerData;
        return lastState;
    }

    @Action
    public setSidebar(lastState: PointsOfInterestState, payload: SetSidebarPayload): PointsOfInterestState {
        lastState.isSidebarOpen =  payload.isOpen;
        return lastState;
    }
}
