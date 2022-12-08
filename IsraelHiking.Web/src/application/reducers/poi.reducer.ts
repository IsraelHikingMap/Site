import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

import type { PointsOfInterestState, MarkerData } from "../models/models";


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
    static actions: {
        setSelectedPoi: ActionPayload<SetSelectedPoiPayload>;
        setUploadMarkerData: ActionPayload<SetUploadMarkerDataPayload>;
        setSidebar: ActionPayload<SetSidebarPayload>;
    };

    @Action
    public setSelectedPoi(lastState: PointsOfInterestState, action: AnyAction<SetSelectedPoiPayload>): PointsOfInterestState {
        lastState.selectedPointOfInterest = action.payload.poi;
        return lastState;
    }

    @Action
    public setUploadMarkerData(lastState: PointsOfInterestState, action: AnyAction<SetUploadMarkerDataPayload>): PointsOfInterestState {
        lastState.uploadMarkerData = action.payload.markerData;
        return lastState;
    }

    @Action
    public setSidebar(lastState: PointsOfInterestState, action: AnyAction<SetSidebarPayload>): PointsOfInterestState {
        lastState.isSidebarOpen =  action.payload.isOpen;
        return lastState;
    }
}
