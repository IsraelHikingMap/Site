import { orderBy, remove } from "lodash";

import { createReducerFromClass, ReduxAction, BaseAction } from "./reducer-action-decorator";
import { initialState, ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP, SATELLITE, HIKING_TRAILS, BICYCLE_TRAILS } from "./initial-state";
import { LayersState, EditableLayer, Overlay } from "../models/models";

const ADD_BASE_LAYER = "ADD_BASE_LAYER";
const ADD_OVERLAY = "ADD_OVERLAY";
const REMOVE_BASE_LAYER = "REMOVE_BASE_LAYER";
const REMOVE_OVERLAY = "REMOVE_OVERLAY";
const UPDATE_BASE_LAYER = "UPDATE_BASE_LAYER";
const UPDATE_OVERLAY = "UPDATE_OVERLAY";
const SELECT_BASE_LAYER = "SELECT_BASE_LAYER";
const EXPAND_GROUP = "EXPAND_GROUP";
const COLLAPSE_GROUP = "COLLAPSE_GROUP";
const SET_ITEM_VISIBILITY = "SET_ITEM_VISIBILITY";
const TOGGLE_OFFLINE = "TOGGLE_OFFLINE";

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

export interface ToggleGroupPayload {
    name: string;
}

export interface SetItemVisibilityPayload {
    name: string;
    visible: boolean;
}

export interface ToggleOfflinePayload {
    key: string;
    isOverlay: boolean;
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

export class ExpandGroupAction extends BaseAction<ToggleGroupPayload> {
    constructor(payload: ToggleGroupPayload) {
        super(EXPAND_GROUP, payload);
    }
}

export class CollapseGroupAction extends BaseAction<ToggleGroupPayload> {
    constructor(payload: ToggleGroupPayload) {
        super(COLLAPSE_GROUP, payload);
    }
}

export class SetItemVisibilityAction extends BaseAction<SetItemVisibilityPayload> {
    constructor(payload: SetItemVisibilityPayload) {
        super(SET_ITEM_VISIBILITY, payload);
    }
}

export class ToggleOfflineAction extends BaseAction<ToggleOfflinePayload> {
    constructor(payload: ToggleOfflinePayload) {
        super(TOGGLE_OFFLINE, payload);
    }
}

class LayersReducer {
    private sort(layers: EditableLayer[]): EditableLayer[] {
        let ordered = orderBy(layers, l => l.key);
        let specialKeys = [ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP, SATELLITE, HIKING_TRAILS, BICYCLE_TRAILS];
        let removed = remove(ordered, o => specialKeys.indexOf(o.key) !== -1);
        ordered = [...removed, ...ordered];
        return ordered;
    }

    @ReduxAction(ADD_BASE_LAYER)
    public addBaseLayer(lastState: LayersState, action: AddBaseLayerAction): LayersState {
        return {
            ...lastState,
            baseLayers: this.sort([...lastState.baseLayers, action.payload.layerData])
        };
    }

    @ReduxAction(ADD_OVERLAY)
    public addOverlay(lastState: LayersState, action: AddOverlayAction): LayersState {
        return {
            ...lastState,
            overlays: this.sort([...lastState.overlays, action.payload.layerData]) as Overlay[]
        };
    }

    @ReduxAction(REMOVE_BASE_LAYER)
    public removeBaseLayer(lastState: LayersState, action: RemoveBaseLayerAction): LayersState {
        let baseLayers = [...lastState.baseLayers];
        baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === action.payload.key)), 1);
        return {
            ...lastState,
            baseLayers
        };
    }

    @ReduxAction(REMOVE_OVERLAY)
    public removeOverlay(lastState: LayersState, action: RemoveOverlayAction): LayersState {
        let overlays = [...lastState.overlays];
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.payload.key)), 1);
        return {
            ...lastState,
            overlays
        };
    }

    @ReduxAction(UPDATE_BASE_LAYER)
    public updateBaseLayer(lastState: LayersState, action: UpdateBaseLayerAction): LayersState {
        let baseLayers = [...lastState.baseLayers];
        baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === action.payload.key)), 1, action.payload.layerData);
        return {
            ...lastState,
            baseLayers
        };
    }

    @ReduxAction(UPDATE_OVERLAY)
    public updateOverlay(lastState: LayersState, action: UpdateOverlayAction): LayersState {
        let overlays = [...lastState.overlays];
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.payload.key)), 1, action.payload.layerData);
        return {
            ...lastState,
            overlays
        };
    }

    @ReduxAction(SELECT_BASE_LAYER)
    public selectBaseLayer(lastState: LayersState, action: SelectBaseLayerAction): LayersState {
        return {
            ...lastState,
            selectedBaseLayerKey: action.payload.key
        };
    }

    @ReduxAction(EXPAND_GROUP)
    public expandGroup(lastState: LayersState, action: ExpandGroupAction): LayersState {
        let expanded = [...lastState.expanded];
        if (expanded.find(n => n === action.payload.name) != null) {
            return lastState;
        }
        expanded.push(action.payload.name);
        return {
            ...lastState,
            expanded
        };
    }

    @ReduxAction(COLLAPSE_GROUP)
    public collapseGroup(lastState: LayersState, action: CollapseGroupAction): LayersState {
        let expanded = [...lastState.expanded];
        if (expanded.find(n => n === action.payload.name) == null) {
            return lastState;
        }
        expanded.splice(expanded.indexOf(action.payload.name));
        return {
            ...lastState,
            expanded
        };
    }

    @ReduxAction(SET_ITEM_VISIBILITY)
    public setItemVisibility(lastState: LayersState, action: SetItemVisibilityAction): LayersState {
        let visible = [...lastState.visible];
        let item = visible.find(n => n.name === action.payload.name);
        if (item == null) {
            item = { name: action.payload.name, visible: action.payload.visible };
            visible.push(item);
            return {
                ...lastState,
                visible
            };
        }
        visible.splice(visible.indexOf(item), 1, { ...item, visible: action.payload.visible });
        return {
            ...lastState,
            visible
        };
    }

    @ReduxAction(TOGGLE_OFFLINE)
    public toggleOffline(lastState: LayersState, action: ToggleOfflineAction): LayersState {
        if (action.payload.isOverlay) {
            let overlays = [...lastState.overlays];
            let layer = overlays.find(b => b.key === action.payload.key);
            let layerData = {
                ...layer,
                isOfflineOn: !layer.isOfflineOn
            } as Overlay;
            overlays.splice(overlays.indexOf(layer), 1, layerData);
            return {
                ...lastState,
                overlays
            };
        } else {
            let baseLayers = [...lastState.baseLayers];
            let layer = baseLayers.find(b => b.key === action.payload.key);
            let layerData = {
                ...layer,
                isOfflineOn: !layer.isOfflineOn
            } as EditableLayer;
            baseLayers.splice(baseLayers.indexOf(layer), 1, layerData);
            return {
                ...lastState,
                baseLayers
            };
        }

    }
}

export const layersReducer = createReducerFromClass(LayersReducer, initialState.layersState);
