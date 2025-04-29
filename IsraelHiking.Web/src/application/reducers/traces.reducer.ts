import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { TracesState, Trace } from "../models/models";

export class AddTraceAction {
    public static type = this.prototype.constructor.name;
    constructor(public trace: Trace) {}
}

export class UpdateTraceAction {
    public static type = this.prototype.constructor.name;
    constructor(public trace: Trace) {}
}

export class RemoveTraceAction {
    public static type = this.prototype.constructor.name;
    constructor(public traceId: string) {}
}

export class BulkReplaceTracesAction {
    public static type = this.prototype.constructor.name;
    constructor(public traces: Trace[]) {}
}

export class SetVisibleTraceAction {
    public static type = this.prototype.constructor.name;
    constructor(public traceId: string) {}
}

export class SetMissingPartsAction {
    public static type = this.prototype.constructor.name;
    constructor(public missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>) {}
}

export class RemoveMissingPartAction {
    public static type = this.prototype.constructor.name;
    constructor(public missingPartIndex: number) {}
}

@State<TracesState>({
    name: "tracesState",
    defaults: initialState.tracesState
})
@Injectable()
export class TracesReducer {

    @Action(AddTraceAction)
    public add(ctx: StateContext<TracesState>, action: AddTraceAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.traces.push(action.trace);
            return lastState;
        }));
    }

    @Action(UpdateTraceAction)
    public update(ctx: StateContext<TracesState>, action: UpdateTraceAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const traceToReplace = lastState.traces.find(r => r.id === action.trace.id);
            lastState.traces.splice(lastState.traces.indexOf(traceToReplace), 1, action.trace);
            return lastState;
        }));
    }

    @Action(RemoveTraceAction)
    public remove(ctx: StateContext<TracesState>, action: RemoveTraceAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const traceToRemove = lastState.traces.find(r => r.id === action.traceId);
            lastState.traces.splice(lastState.traces.indexOf(traceToRemove), 1);
            return lastState;
        }));
    }

    @Action(BulkReplaceTracesAction)
    public bulkReplace(ctx: StateContext<TracesState>, action: BulkReplaceTracesAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.traces = action.traces;
            return lastState;
        }));
    }

    @Action(SetVisibleTraceAction)
    public setVisibleTrace(ctx: StateContext<TracesState>, action: SetVisibleTraceAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.visibleTraceId = action.traceId;
            return lastState;
        }));
    }

    @Action(SetMissingPartsAction)
    public setMissingPart(ctx: StateContext<TracesState>, action: SetMissingPartsAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.missingParts = action.missingParts;
            return lastState;
        }));
    }

    @Action(RemoveMissingPartAction)
    public removeMissingPart(ctx: StateContext<TracesState>, action: RemoveMissingPartAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.missingParts.features.splice(action.missingPartIndex, 1);
            return lastState;
        }));
    }
}
