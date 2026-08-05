import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { LocationState } from "../models";

export class SetLocationAction {
    public static readonly type = "[Location] SetLocationAction";
    constructor(public readonly longitude: number, public readonly latitude: number, public readonly zoom: number) {}
}

@State({
    name: "locationState",
    defaults: initialState.locationState
})
@Injectable()
export class LocationReducer {

    @Action(SetLocationAction)
    public setLocation(ctx: StateContext<LocationState>, action: SetLocationAction) {
        ctx.setState(produce(ctx.getState(), lastState => ({
            zoom: action.zoom || lastState.zoom,
            longitude: action.longitude || lastState.longitude,
            latitude: action.latitude || lastState.latitude
        })));
    }
}
