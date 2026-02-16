import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { LatLngAltTime, MarkerData, RecordedRouteState } from "../models";

export class StartRecordingAction {
    public static type = this.prototype.constructor.name;
}

export class StopRecordingAction {
    public static type = this.prototype.constructor.name;
}

export class ToggleAddRecordingPoiAction {
    public static type = this.prototype.constructor.name;
}

export class AddRecordingRoutePointsAction {
    public static type = this.prototype.constructor.name;
    constructor(public latlngs: LatLngAltTime[]) { }
}

export class AddPendingProcessingRoutePointAction {
    public static type = this.prototype.constructor.name;
    constructor(public position: GeolocationPosition) { }
}

export class ClearPendingProcessingRoutePointsAction {
    public static type = this.prototype.constructor.name;
}

export class AddRecordingPoiAction {
    public static type = this.prototype.constructor.name;
    constructor(public markerData: MarkerData) { }
}

export class UpdateRecordingPoiAction {
    public static type = this.prototype.constructor.name;
    constructor(public index: number, public markerData: MarkerData) { }
}

export class DeleteRecordingPoiAction {
    public static type = this.prototype.constructor.name;
    constructor(public index: number) { }
}

@State<RecordedRouteState>({
    name: "recordedRouteState",
    defaults: initialState.recordedRouteState
})
@Injectable()
export class RecordedRouteReducer {

    @Action(StartRecordingAction)
    public startRecording(ctx: StateContext<RecordedRouteState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isRecording = true;
            lastState.isAddingPoi = false;
            lastState.route = {
                latlngs: [],
                markers: []
            };
            return lastState;
        }));
    }

    @Action(StopRecordingAction)
    public stopRecording(ctx: StateContext<RecordedRouteState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isRecording = false;
            lastState.isAddingPoi = false;
            lastState.route = null;
            return lastState;
        }));
    }

    @Action(AddRecordingRoutePointsAction)
    public addRecordingPoints(ctx: StateContext<RecordedRouteState>, action: AddRecordingRoutePointsAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.route.latlngs = [...lastState.route.latlngs, ...action.latlngs];
            return lastState;
        }));
    }

    @Action(AddPendingProcessingRoutePointAction)
    public addPendingProcessingPoint(ctx: StateContext<RecordedRouteState>, action: AddPendingProcessingRoutePointAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.pendingProcessing == null) {
                lastState.pendingProcessing = [];
            }
            lastState.pendingProcessing.push(action.position);
            return lastState;
        }));
    }

    @Action(ClearPendingProcessingRoutePointsAction)
    public clearPendingProcessingPoints(ctx: StateContext<RecordedRouteState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.pendingProcessing = [];
            return lastState;
        }));
    }

    @Action(ToggleAddRecordingPoiAction)
    public toggleAddRecordingPoi(ctx: StateContext<RecordedRouteState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.isAddingPoi = !lastState.isAddingPoi;
            return lastState;
        }));
    }

    @Action(AddRecordingPoiAction)
    public addRecordingPoi(ctx: StateContext<RecordedRouteState>, action: AddRecordingPoiAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.route.markers.push(action.markerData);
            return lastState;
        }));
    }

    @Action(UpdateRecordingPoiAction)
    public updateRecordingPoi(ctx: StateContext<RecordedRouteState>, action: UpdateRecordingPoiAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.route.markers.splice(action.index, 1, action.markerData);
            return lastState;
        }));
    }

    @Action(DeleteRecordingPoiAction)
    public deleteRecordingPoi(ctx: StateContext<RecordedRouteState>, action: DeleteRecordingPoiAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.route.markers.splice(action.index, 1);
            return lastState;
        }));
    }
}
