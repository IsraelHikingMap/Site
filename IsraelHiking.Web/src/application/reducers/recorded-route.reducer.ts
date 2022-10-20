import { Action } from "redux";
import { Action as ReduxAction, createReducerFromClass } from "@angular-redux2/store";
import { LatLngAltTime, MarkerData, RecordedRouteState } from "../models/models";
import { BaseAction, initialState } from "./initial-state";

const START_RECORDING = "START_RECORDING";
const STOP_RECORDING = "STOP_RECORDING";
const ADD_RECORDING_ROUTE_POINTS = "ADD_RECORDING_ROUTE_POINTS";
const TOGGLE_ADDING_POI = "TOGGLE_ADDING_POI";
const ADD_RECORDING_MARKER = "ADD_RECORDING_MARKER";
const UPDATE_RECORDING_MARKER = "UPDATE_RECORDING_MARKER";
const DELETE_RECORDING_MARKER = "DELETE_RECORDING_MARKER";

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

export class StartRecordingAction implements Action {
    constructor(public type = START_RECORDING) {}
}

export class StopRecordingAction implements Action {
    constructor(public type = STOP_RECORDING) {}
}

export class ToggleAddRecordingPoiAction implements Action {
    constructor(public type = TOGGLE_ADDING_POI) {}
}

export class AddRecordingRoutePointsAction extends BaseAction<AddRecordingPointsPayload> {
    constructor(payload: AddRecordingPointsPayload) {
        super(ADD_RECORDING_ROUTE_POINTS, payload);
    }
}

export class AddRecordingPoiAction extends BaseAction<AddRecordingPoiPayload> {
    constructor(payload: AddRecordingPoiPayload) {
        super(ADD_RECORDING_MARKER, payload);
    }
}

export class UpdateRecordingPoiAction extends BaseAction<UpdateRecordingPoiPayload>{
    constructor(payload: UpdateRecordingPoiPayload) {
        super(UPDATE_RECORDING_MARKER, payload);
    }
}

export class DeleteRecordingPoiAction extends BaseAction<DeleteRecordingPoiPayload>{
    constructor(payload: DeleteRecordingPoiPayload) {
        super(DELETE_RECORDING_MARKER, payload);
    }
}

class RecordedRouteReducer {
    @ReduxAction(START_RECORDING)
    public startRecording(lastState: RecordedRouteState, _: StartRecordingAction): RecordedRouteState {
        return {
            ...lastState,
            isRecording: true,
            isAddingPoi: false,
            route: {
                latlngs: [],
                markers: []
            }
        };
    }

    @ReduxAction(STOP_RECORDING)
    public stopRecording(lastState: RecordedRouteState, _: StopRecordingAction): RecordedRouteState {
        return {
            ...lastState,
            isRecording: false,
            isAddingPoi: false,
            route: null
        };
    }

    @ReduxAction(ADD_RECORDING_ROUTE_POINTS)
    public addRecordingRoutePoints(lastState: RecordedRouteState, action: AddRecordingRoutePointsAction): RecordedRouteState {
        return {
            ...lastState,
            route: {
                ...lastState.route,
                latlngs: [...lastState.route.latlngs, ...action.payload.latlngs]
            }
        };
    }

    @ReduxAction(TOGGLE_ADDING_POI)
    public toggleAddingPoi(lastState: RecordedRouteState, _: ToggleAddRecordingPoiAction): RecordedRouteState {
        return {
            ...lastState,
            isAddingPoi: !lastState.isAddingPoi
        };
    }

    @ReduxAction(ADD_RECORDING_MARKER)
    public addRecordingPoi(lastState: RecordedRouteState, action: AddRecordingPoiAction): RecordedRouteState {
        return {
            ...lastState,
            route: {
                ...lastState.route,
                markers: [...lastState.route.markers, action.payload.markerData]
            }
        };
    }

    @ReduxAction(UPDATE_RECORDING_MARKER)
    public updateRecordingPoi(lastState: RecordedRouteState, action: UpdateRecordingPoiAction): RecordedRouteState {
        let markers = [...lastState.route.markers];
        markers.splice(action.payload.index, 1, action.payload.markerData);
        return {
            ...lastState,
            route: {
                ...lastState.route,
                markers
            }
        };
    }

    @ReduxAction(DELETE_RECORDING_MARKER)
    public deleteRecordingPoi(lastState: RecordedRouteState, action: DeleteRecordingPoiAction): RecordedRouteState {
        let markers = [...lastState.route.markers];
        markers.splice(action.payload.index, 1);
        return {
            ...lastState,
            route: {
                ...lastState.route,
                markers
            }
        };
    }
}

export const recordedRouteReducer = createReducerFromClass(RecordedRouteReducer, initialState.recordedRouteState);
