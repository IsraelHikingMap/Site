import { createReducerFromClass, ReduxAction, BaseAction } from "./reducer-action-decorator";
import { initialState } from "./initial-state";
import { LayersState, EditableLayer, Overlay } from "../models/models";

const ADD_BASE_LAYER = "ADD_BASE_LAYER";
const ADD_OVERLAY = "ADD_OVERLAY";
const REMOVE_BASE_LAYER = "REMOVE_BASE_LAYER";
const REMOVE_OVERLAY = "REMOVE_OVERLAY";
const UPDATE_BASE_LAYER = "UPDATE_BASE_LAYER";
const UPDATE_OVERLAY = "UPDATE_OVERLAY";
const SELECT_BASE_LAYER = "SELECT_BASE_LAYER";

export interface AddBaseLayerPayload {
    layerData: EditableLayer;
}

export interface AddOverlayPayload {
    layerData: Overlay;
}

export interface RemoveLayerPayload {
    key: string;
}

export interface UpdateBaseLayerPayload {
    key: string;
    layerData: EditableLayer;
}

export interface UpdateOverlayPayload {
    key: string;
    layerData: Overlay;
}

export interface SelectBaseLayerPayload {
    key: string;
}

export class AddBaseLayerAction extends BaseAction<AddBaseLayerPayload> {
    constructor(payload: AddBaseLayerPayload) {
        super(ADD_BASE_LAYER, payload);
    }
}

export class AddOverlayAction extends BaseAction<AddOverlayPayload> {
    constructor(payload: AddOverlayPayload) {
        super(ADD_OVERLAY, payload);
    }
}

export class RemoveBaseLayerAction extends BaseAction<RemoveLayerPayload> {
    constructor(payload: RemoveLayerPayload) {
        super(REMOVE_BASE_LAYER, payload);
    }
}

export class RemoveOverlayAction extends BaseAction<RemoveLayerPayload> {
    constructor(payload: RemoveLayerPayload) {
        super(REMOVE_OVERLAY, payload);
    }
}

export class UpdateBaseLayerAction extends BaseAction<UpdateBaseLayerPayload> {
    constructor(payload: UpdateBaseLayerPayload) {
        super(UPDATE_BASE_LAYER, payload);
    }
}

export class UpdateOverlayAction extends BaseAction<UpdateOverlayPayload> {
    constructor(payload: UpdateOverlayPayload) {
        super(UPDATE_OVERLAY, payload);
    }
}

export class SelectBaseLayerAction extends BaseAction<SelectBaseLayerPayload> {
    constructor(payload: SelectBaseLayerPayload) {
        super(SELECT_BASE_LAYER, payload);
    }
}

class LayersReducer {
    @ReduxAction(ADD_BASE_LAYER)
    public addBaseLayer(lastState: LayersState, action: AddBaseLayerAction) {
        return {
            ...lastState,
            baseLayers: [...lastState.baseLayers, action.payload.layerData]
        };
    }

    @ReduxAction(ADD_OVERLAY)
    public addOverlay(lastState: LayersState, action: AddOverlayAction) {
        return {
            ...lastState,
            overlays: [...lastState.overlays, action.payload.layerData]
        };
    }

    @ReduxAction(REMOVE_BASE_LAYER)
    public removeBaseLayer(lastState: LayersState, action: RemoveBaseLayerAction) {
        let baseLayers = [...lastState.baseLayers];
        baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === action.payload.key)), 1);
        return {
            ...lastState,
            baseLayers: baseLayers
        };
    }

    @ReduxAction(REMOVE_OVERLAY)
    public removeOverlay(lastState: LayersState, action: RemoveOverlayAction) {
        let overlays = [...lastState.overlays];
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.payload.key)), 1);
        return {
            ...lastState,
            overlays: overlays
        };
    }

    @ReduxAction(UPDATE_BASE_LAYER)
    public updateBaseLayer(lastState: LayersState, action: UpdateBaseLayerAction) {
        let baseLayers = [...lastState.baseLayers];
        baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === action.payload.key)), 1, action.payload.layerData);
        return {
            ...lastState,
            baseLayers: baseLayers
        };
    }

    @ReduxAction(UPDATE_OVERLAY)
    public updateOverlay(lastState: LayersState, action: UpdateOverlayAction) {
        let overlays = [...lastState.overlays];
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.payload.key)), 1, action.payload.layerData);
        return {
            ...lastState,
            overlays: overlays
        };
    }

    @ReduxAction(SELECT_BASE_LAYER)
    public selectBaseLayer(lastState: LayersState, action: SelectBaseLayerAction) {
        return {
            ...lastState,
            selectedBaseLayerKey: action.payload.key
        };
    }
}

export const layersReducer = createReducerFromClass(LayersReducer, initialState.layersState);