import { ReduxAction, createReducerFromClass, BaseAction } from "@angular-redux2/store";

import { initialState } from "./initial-state";
import type { TracesState, Trace } from "../models/models";

const ADD_TRACE = "ADD_TRACE";
const UPDATE_TRACE = "UPDATE_TRACE";
const REMOVE_TRACE = "REMOVE_TRACE";
const SET_VISIBLE_TRACE = "SET_VISIBLE_TRACE";
const SET_MISSING_PARTS = "SET_MISSING_PARTS";
const REMOVE_MISSING_PART = "REMOVE_MISSING_PART";

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

export class AddTraceAction extends BaseAction<AddTracePayload> {
    constructor(payload: AddTracePayload) {
        super(ADD_TRACE, payload);
    }
}

export class UpdateTraceAction extends BaseAction<UpdateTracePayload> {
    constructor(payload: UpdateTracePayload) {
        super(UPDATE_TRACE, payload);
    }
}

export class RemoveTraceAction extends BaseAction<RemoveTracePayload> {
    constructor(payload: RemoveTracePayload) {
        super(REMOVE_TRACE, payload);
    }
}

export class SetVisibleTraceAction extends BaseAction<SetVisibleTracePayload> {
    constructor(payload: SetVisibleTracePayload) {
        super(SET_VISIBLE_TRACE, payload);
    }
}

export class SetMissingPartsAction extends BaseAction<SetMissingPartsPayload> {
    constructor(payload: SetMissingPartsPayload) {
        super(SET_MISSING_PARTS, payload);
    }
}

export class RemoveMissingPartAction extends BaseAction<RemoveMissingPartPayload> {
    constructor(payload: RemoveMissingPartPayload) {
        super(REMOVE_MISSING_PART, payload);
    }
}

export class TracesReducer {
    @ReduxAction(ADD_TRACE)
    public add(lastState: TracesState, action: AddTraceAction) {
        return {
            ...lastState,
            traces: [...lastState.traces, action.payload.trace]
        };
    }

    @ReduxAction(UPDATE_TRACE)
    public update(lastState: TracesState, action: UpdateTraceAction) {
        let traces = [...lastState.traces];
        let traceToReplace = traces.find(r => r.id === action.payload.traceId);
        traces.splice(traces.indexOf(traceToReplace), 1, action.payload.trace);
        return {
            ...lastState,
            traces
        };
    }

    @ReduxAction(REMOVE_TRACE)
    public remove(lastState: TracesState, action: RemoveTraceAction) {
        let traces = [...lastState.traces];
        let traceToRemove = traces.find(r => r.id === action.payload.traceId);
        traces.splice(traces.indexOf(traceToRemove), 1);
        return {
            ...lastState,
            traces
        };
    }

    @ReduxAction(SET_VISIBLE_TRACE)
    public setVisibleTrace(lastState: TracesState, action: SetVisibleTraceAction) {
        return {
            ...lastState,
            visibleTraceId: action.payload.traceId
        };
    }

    @ReduxAction(SET_MISSING_PARTS)
    public setMissingPart(lastState: TracesState, action: SetMissingPartsAction) {
        return {
            ...lastState,
            missingParts: action.payload.missingParts
        };
    }

    @ReduxAction(REMOVE_MISSING_PART)
    public removeMissingPart(lastState: TracesState, action: RemoveMissingPartAction) {
        let missingParts = { ...lastState.missingParts };
        let features = [...missingParts.features];
        features.splice(action.payload.missingPartIndex, 1);
        missingParts.features = features;
        return {
            ...lastState,
            missingParts
        };
    }
}

export const tracesReducer = createReducerFromClass(TracesReducer, initialState.tracesState);
