import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

import { LatLngAltTime, MarkerData, RecordedRouteState } from "../models/models";

export type AddRecordingPointsPayload = {
    latlngs: LatLngAltTime[];
};

export type AddRecordingPoiPayload = {
    markerData: MarkerData;
};

export type UpdateRecordingPoiPayload = {
    index: number;
    markerData: MarkerData;
};

export type DeleteRecordingPoiPayload = {
    index: number;
};

export class RecordedRouteReducer extends AbstractReducer {
    static actions: {
        startRecording: ActionPayload<void>;
        stopRecording: ActionPayload<void>;
        addRecordingPoints: ActionPayload<AddRecordingPointsPayload>;
        toggleAddingPoi: ActionPayload<void>;
        addRecordingPoi: ActionPayload<AddRecordingPoiPayload>;
        updateRecordingPoi: ActionPayload<UpdateRecordingPoiPayload>;
        deleteRecordingPoi: ActionPayload<DeleteRecordingPoiPayload>;
    };

    @Action
    public startRecording(lastState: RecordedRouteState, _action: AnyAction<void>): RecordedRouteState {
        lastState.isRecording = true;
        lastState.isAddingPoi = false;
        lastState.route = {
            latlngs: [],
            markers: []
        };
        return lastState;
    }

    @Action
    public stopRecording(lastState: RecordedRouteState, _action: AnyAction<void>): RecordedRouteState {
        lastState.isRecording = false;
        lastState.isAddingPoi = false;
        lastState.route = null;
        return lastState;
    }

    @Action
    public addRecordingPoints(lastState: RecordedRouteState, action: AnyAction<AddRecordingPointsPayload>): RecordedRouteState {
        lastState.route.latlngs = [...lastState.route.latlngs, ...action.payload.latlngs];
        return lastState;
    }

    @Action
    public toggleAddingPoi(lastState: RecordedRouteState, _action: AnyAction<void>): RecordedRouteState {
        lastState.isAddingPoi = !lastState.isAddingPoi;
        return lastState;
    }

    @Action
    public addRecordingPoi(lastState: RecordedRouteState, action: AnyAction<AddRecordingPoiPayload>): RecordedRouteState {
        lastState.route.markers.push(action.payload.markerData);
        return lastState;
    }

    @Action
    public updateRecordingPoi(lastState: RecordedRouteState, action: AnyAction<UpdateRecordingPoiPayload>): RecordedRouteState {
        lastState.route.markers.splice(action.payload.index, 1, action.payload.markerData);
        return lastState;
    }

    @Action
    public deleteRecordingPoi(lastState: RecordedRouteState, action: AnyAction<DeleteRecordingPoiPayload>): RecordedRouteState {
        lastState.route.markers.splice(action.payload.index, 1);
        return lastState;
    }
}
