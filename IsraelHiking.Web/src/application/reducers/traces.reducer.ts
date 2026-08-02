import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { TracesState, Trace } from "../models";

export class AddTraceAction {
    public static readonly type = "[Traces] AddTraceAction";
    constructor(public readonly trace: Trace) { }
}

export class UpdateTraceAction {
    public static readonly type = "[Traces] UpdateTraceAction";
    constructor(public readonly trace: Trace) { }
}

export class RemoveTraceAction {
    public static readonly type = "[Traces] RemoveTraceAction";
    constructor(public readonly traceId: string) { }
}

export class BulkReplaceTracesAction {
    public static readonly type = "[Traces] BulkReplaceTracesAction";
    constructor(public readonly traces: Trace[]) { }
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
}
