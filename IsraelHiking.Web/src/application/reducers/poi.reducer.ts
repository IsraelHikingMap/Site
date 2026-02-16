import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { PointsOfInterestState, MarkerData } from "../models";


export class SetSelectedPoiAction {
    public static type = this.prototype.constructor.name;
    constructor(public poi: GeoJSON.Feature) { }
}

export class SetUploadMarkerDataAction {
    public static type = this.prototype.constructor.name;
    constructor(public markerData: MarkerData) { }
}

@State<PointsOfInterestState>({
    name: "poiState",
    defaults: initialState.poiState
})
@Injectable()
export class PointsOfInterestReducer {

    @Action(SetSelectedPoiAction)
    public setSelectedPoi(ctx: StateContext<PointsOfInterestState>, action: SetSelectedPoiAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.selectedPointOfInterest = action.poi;
            return lastState;
        }));
    }

    @Action(SetUploadMarkerDataAction)
    public setUploadMarkerData(ctx: StateContext<PointsOfInterestState>, action: SetUploadMarkerDataAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.uploadMarkerData = action.markerData;
            return lastState;
        }));
    }
}
