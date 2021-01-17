import { orderBy, remove, some } from "lodash";

import { createReducerFromClass, ReduxAction, BaseAction } from "./reducer-action-decorator";
import { initialState, ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP, SATELLITE, HIKING_TRAILS, BICYCLE_TRAILS } from "./initial-state";
import { LayersState, EditableLayer, Overlay, CategoriesGroupType, Category } from "../models/models";

const ADD_BASE_LAYER = "ADD_BASE_LAYER";
const ADD_OVERLAY = "ADD_OVERLAY";
const REMOVE_BASE_LAYER = "REMOVE_BASE_LAYER";
const REMOVE_OVERLAY = "REMOVE_OVERLAY";
const UPDATE_BASE_LAYER = "UPDATE_BASE_LAYER";
const UPDATE_OVERLAY = "UPDATE_OVERLAY";
const SELECT_BASE_LAYER = "SELECT_BASE_LAYER";
const EXPAND_GROUP = "EXPAND_GROUP";
const COLLAPSE_GROUP = "COLLAPSE_GROUP";
const SET_CATEGORIES_GROUP_VISIBILITY = "SET_CATEGORIES_GROUP_VISIBILITY";
const ADD_CATEGORY = "ADD_CATEGORY";
const SET_CATEGORY_VISIBILITY = "SET_CATEGORY_VISIBILITY";
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

export interface SetCategoriesGroupVisibilityPayload {
    groupType: CategoriesGroupType;
    visible: boolean;
}

export interface AddCategoryPayload {
    groupType: CategoriesGroupType;
    category: Category;
}

export interface SetCategoryVisibilityPayload {
    name: string;
    groupType: CategoriesGroupType;
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

export class SetCategoriesGroupVisibilityAction extends BaseAction<SetCategoriesGroupVisibilityPayload> {
    constructor(payload: SetCategoriesGroupVisibilityPayload) {
        super(SET_CATEGORIES_GROUP_VISIBILITY, payload);
    }
}

export class AddCategoryAction extends BaseAction<AddCategoryPayload> {
    constructor(payload: AddCategoryPayload) {
        super(ADD_CATEGORY, payload);
    }
}

export class SetCategoryVisibilityAction extends BaseAction<SetCategoryVisibilityPayload> {
    constructor(payload: SetCategoryVisibilityPayload) {
        super(SET_CATEGORY_VISIBILITY, payload);
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
            baseLayers: this.sort(baseLayers)
        };
    }

    @ReduxAction(UPDATE_OVERLAY)
    public updateOverlay(lastState: LayersState, action: UpdateOverlayAction): LayersState {
        let overlays = [...lastState.overlays];
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.payload.key)), 1, action.payload.layerData);
        return {
            ...lastState,
            overlays: this.sort(overlays) as Overlay[]
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

    @ReduxAction(ADD_CATEGORY)
    public addCategory(lastState: LayersState, action: AddCategoryAction): LayersState {
        let groups = [...lastState.categoriesGroups];
        let group = groups.find(g => g.type === action.payload.groupType);
        let categories = [...group.categories];
        categories.push(action.payload.category);
        let newGroup = {
            ...group,
            categories
        };
        groups.splice(groups.indexOf(group), 1, newGroup);
        return {
            ...lastState,
            categoriesGroups: groups
        };
    }

    @ReduxAction(SET_CATEGORY_VISIBILITY)
    public setCatgegoryVisibility(lastState: LayersState, action: SetCategoryVisibilityAction): LayersState {
        let groups = [...lastState.categoriesGroups];
        let group = groups.find(g => g.type === action.payload.groupType);
        let categories = [...group.categories];
        let category = categories.find(c => c.name === action.payload.name);
        let newCategory = {
            ...category,
            visible: action.payload.visible
        };
        categories.splice(categories.indexOf(category), 1, newCategory);
        let newGroup = {
            ...group,
            categories,
            visible: some(categories, c => c.visible)
        };
        groups.splice(groups.indexOf(group), 1, newGroup);
        return {
            ...lastState,
            categoriesGroups: groups
        };
    }

    @ReduxAction(SET_CATEGORIES_GROUP_VISIBILITY)
    public setCatgegoriesGroupVisibility(lastState: LayersState, action: SetCategoriesGroupVisibilityAction): LayersState {
        let groups = [...lastState.categoriesGroups];
        let group = groups.find(g => g.type === action.payload.groupType);
        let categories = [];
        for (let category of group.categories) {
            categories.push({
                ...category,
                visible: action.payload.visible
            });
        }
        let newGroup = {
            ...group,
            categories,
            visible: action.payload.visible
        };
        groups.splice(groups.indexOf(group), 1, newGroup);
        return {
            ...lastState,
            categoriesGroups: groups
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
