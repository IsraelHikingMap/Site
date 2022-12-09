import { Action, AbstractReducer } from "@angular-redux2/store";

import type { TracesState, Trace } from "../models/models";
import type { ReducerActions } from "./initial-state";

export type AddTracePayload = {
    trace: Trace;
};

export type UpdateTracePayload = {
    traceId: string;
    trace: Trace;
};

export type RemoveTracePayload = {
    traceId: string;
};

export type SetVisibleTracePayload = {
    traceId: string;
};

export type SetMissingPartsPayload = {
    missingParts: GeoJSON.FeatureCollection<GeoJSON.LineString>;
};

export type RemoveMissingPartPayload = {
    missingPartIndex: number;
};

export class TracesReducer extends AbstractReducer {
    static actions: ReducerActions<TracesReducer>;

    @Action
    public add(lastState: TracesState, payload: AddTracePayload): TracesState {
        lastState.traces.push(payload.trace);
        return lastState;
    }

    @Action
    public update(lastState: TracesState, payload: UpdateTracePayload): TracesState {
        let traceToReplace = lastState.traces.find(r => r.id === payload.traceId);
        lastState.traces.splice(lastState.traces.indexOf(traceToReplace), 1, payload.trace);
        return lastState;
    }

    @Action
    public remove(lastState: TracesState, payload: RemoveTracePayload): TracesState {
        let traceToRemove = lastState.traces.find(r => r.id === payload.traceId);
        lastState.traces.splice(lastState.traces.indexOf(traceToRemove), 1);
        return lastState;
    }

    @Action
    public setVisibleTrace(lastState: TracesState, payload: SetVisibleTracePayload): TracesState {
        lastState.visibleTraceId = payload.traceId;
        return lastState;
    }

    @Action
    public setMissingPart(lastState: TracesState, payload: SetMissingPartsPayload): TracesState {
        lastState.missingParts = payload.missingParts;
        return lastState;
    }

    @Action
    public removeMissingPart(lastState: TracesState, payload: RemoveMissingPartPayload): TracesState {
        lastState.missingParts.features.splice(payload.missingPartIndex, 1);
        return lastState;
    }
}
