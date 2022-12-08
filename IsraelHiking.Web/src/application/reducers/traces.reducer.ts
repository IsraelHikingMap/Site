import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

import type { TracesState, Trace } from "../models/models";

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
    static actions: {
        add: ActionPayload<AddTracePayload>;
        update: ActionPayload<UpdateTracePayload>;
        remove: ActionPayload<RemoveTracePayload>;
        setVisibleTrace: ActionPayload<SetVisibleTracePayload>;
        setMissingPart: ActionPayload<SetMissingPartsPayload>;
        removeMissingPart: ActionPayload<RemoveMissingPartPayload>;
    };

    @Action
    public add(lastState: TracesState, action: AnyAction<AddTracePayload>) {
        lastState.traces.push(action.payload.trace);
        return lastState;
    }

    @Action
    public update(lastState: TracesState, action: AnyAction<UpdateTracePayload>) {
        let traceToReplace = lastState.traces.find(r => r.id === action.payload.traceId);
        lastState.traces.splice(lastState.traces.indexOf(traceToReplace), 1, action.payload.trace);
        return lastState;
    }

    @Action
    public remove(lastState: TracesState, action: AnyAction<RemoveTracePayload>) {
        let traceToRemove = lastState.traces.find(r => r.id === action.payload.traceId);
        lastState.traces.splice(lastState.traces.indexOf(traceToRemove), 1);
        return lastState;
    }

    @Action
    public setVisibleTrace(lastState: TracesState, action: AnyAction<SetVisibleTracePayload>) {
        lastState.visibleTraceId = action.payload.traceId;
        return lastState;
    }

    @Action
    public setMissingPart(lastState: TracesState, action: AnyAction<SetMissingPartsPayload>) {
        lastState.missingParts = action.payload.missingParts;
        return lastState;
    }

    @Action
    public removeMissingPart(lastState: TracesState, action: AnyAction<RemoveMissingPartPayload>) {
        lastState.missingParts.features.splice(action.payload.missingPartIndex, 1);
        return lastState;
    }
}
