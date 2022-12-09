import { Action, AbstractReducer } from "@angular-redux2/store";

import type { LatLngAltTime, MarkerData, RecordedRouteState } from "../models/models";
import type { ReducerActions } from "./initial-state";

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
    static actions: ReducerActions<RecordedRouteReducer>;

    @Action
    public startRecording(lastState: RecordedRouteState): RecordedRouteState {
        lastState.isRecording = true;
        lastState.isAddingPoi = false;
        lastState.route = {
            latlngs: [],
            markers: []
        };
        return lastState;
    }

    @Action
    public stopRecording(lastState: RecordedRouteState): RecordedRouteState {
        lastState.isRecording = false;
        lastState.isAddingPoi = false;
        lastState.route = null;
        return lastState;
    }

    @Action
    public addRecordingPoints(lastState: RecordedRouteState, payload: AddRecordingPointsPayload): RecordedRouteState {
        lastState.route.latlngs = [...lastState.route.latlngs, ...payload.latlngs];
        return lastState;
    }

    @Action
    public toggleAddingPoi(lastState: RecordedRouteState): RecordedRouteState {
        lastState.isAddingPoi = !lastState.isAddingPoi;
        return lastState;
    }

    @Action
    public addRecordingPoi(lastState: RecordedRouteState, payload: AddRecordingPoiPayload): RecordedRouteState {
        lastState.route.markers.push(payload.markerData);
        return lastState;
    }

    @Action
    public updateRecordingPoi(lastState: RecordedRouteState, payload: UpdateRecordingPoiPayload): RecordedRouteState {
        lastState.route.markers.splice(payload.index, 1, payload.markerData);
        return lastState;
    }

    @Action
    public deleteRecordingPoi(lastState: RecordedRouteState, payload: DeleteRecordingPoiPayload): RecordedRouteState {
        lastState.route.markers.splice(payload.index, 1);
        return lastState;
    }
}
