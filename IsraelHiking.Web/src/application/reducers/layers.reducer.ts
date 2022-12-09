import { orderBy, remove } from "lodash-es";
import { Action, AbstractReducer, ActionPayload } from "@angular-redux2/store";

import { ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP, SATELLITE, HIKING_TRAILS, BICYCLE_TRAILS } from "./initial-state";
import type { LayersState, EditableLayer, Overlay, CategoriesGroupType, Category } from "../models/models";

export type AddBaseLayerPayload = {
    layerData: EditableLayer;
};

export type AddOverlayPayload = {
    layerData: Overlay;
};

export type RemoveLayerPayload = {
    key: string;
};

export type UpdateBaseLayerPayload = {
    key: string;
    layerData: EditableLayer;
};

export type UpdateOverlayPayload = {
    key: string;
    layerData: Overlay;
};

export type SelectBaseLayerPayload = {
    key: string;
};

export type ToggleGroupPayload = {
    name: string;
};

export type SetCategoriesGroupVisibilityPayload = {
    groupType: CategoriesGroupType;
    visible: boolean;
};

export type AddCategoryPayload = {
    groupType: CategoriesGroupType;
    category: Category;
};

export type UpdateCategoryPayload = {
    groupType: CategoriesGroupType;
    category: Category;
};

export type RemoveCategoryPayload = {
    groupType: CategoriesGroupType;
    categoryName: string;
};

export type SetCategoryVisibilityPayload = {
    name: string;
    groupType: CategoriesGroupType;
    visible: boolean;
};

export type ToggleOfflinePayload = {
    key: string;
    isOverlay: boolean;
};

export class LayersReducer extends AbstractReducer {
    static actions: {
        addBaseLayer: ActionPayload<AddBaseLayerPayload>;
        addOverlay: ActionPayload<AddOverlayPayload>;
        removeBaseLayer: ActionPayload<RemoveLayerPayload>;
        removeOverlay: ActionPayload<RemoveLayerPayload>;
        updateBaseLayer: ActionPayload<UpdateBaseLayerPayload>;
        updateOverlay: ActionPayload<UpdateOverlayPayload>;
        selectBaseLayer: ActionPayload<SelectBaseLayerPayload>;
        expandGroup: ActionPayload<ToggleGroupPayload>;
        collapseGroup: ActionPayload<ToggleGroupPayload>;
        addCategory: ActionPayload<AddCategoryPayload>;
        updateCategory: ActionPayload<UpdateCategoryPayload>;
        removeCategory: ActionPayload<RemoveCategoryPayload>;
        setCategoryVisibility: ActionPayload<SetCategoryVisibilityPayload>;
        setCategoriesGroupVisibility: ActionPayload<SetCategoriesGroupVisibilityPayload>;
        toggleOffline: ActionPayload<ToggleOfflinePayload>;
    };


    private sort(layers: EditableLayer[]): EditableLayer[] {
        let ordered = orderBy(layers, l => l.key);
        let specialKeys = [ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP, SATELLITE, HIKING_TRAILS, BICYCLE_TRAILS];
        let removed = remove(ordered, o => specialKeys.indexOf(o.key) !== -1);
        ordered = [...removed, ...ordered];
        return ordered;
    }

    @Action
    public addBaseLayer(lastState: LayersState, payload: AddBaseLayerPayload): LayersState {
        lastState.baseLayers.push(payload.layerData);
        lastState.baseLayers = this.sort(lastState.baseLayers);
        return lastState;
    }

    @Action
    public addOverlay(lastState: LayersState, payload: AddOverlayPayload): LayersState {
        lastState.overlays.push(payload.layerData);
        lastState.overlays = this.sort(lastState.overlays) as Overlay[];
        return lastState;
    }

    @Action
    public removeBaseLayer(lastState: LayersState, payload: RemoveLayerPayload): LayersState {
        let baseLayers = lastState.baseLayers;
        baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === payload.key)), 1);
        return lastState;
    }

    @Action
    public removeOverlay(lastState: LayersState, payload: RemoveLayerPayload): LayersState {
        let overlays = lastState.overlays;
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === payload.key)), 1);
        return lastState;
    }

    @Action
    public updateBaseLayer(lastState: LayersState, payload: UpdateBaseLayerPayload): LayersState {
        let baseLayers = lastState.baseLayers;
        baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === payload.key)), 1, payload.layerData);
        lastState.baseLayers = this.sort(baseLayers);
        return lastState;
    }

    @Action
    public updateOverlay(lastState: LayersState, payload: UpdateOverlayPayload): LayersState {
        let overlays = lastState.overlays;
        overlays.splice(overlays.indexOf(overlays.find(o => o.key === payload.key)), 1, payload.layerData);
        lastState.overlays = this.sort(overlays) as Overlay[];
        return lastState;
    }

    @Action
    public selectBaseLayer(lastState: LayersState, payload: SelectBaseLayerPayload): LayersState {
        lastState.selectedBaseLayerKey = payload.key;
        return lastState;
    }

    @Action
    public expandGroup(lastState: LayersState, payload: ToggleGroupPayload): LayersState {
        if (lastState.expanded.find(n => n === payload.name) != null) {
            return lastState;
        }
        lastState.expanded.push(payload.name);
        return lastState;
    }

    @Action
    public collapseGroup(lastState: LayersState, payload: ToggleGroupPayload): LayersState {
        if (lastState.expanded.find(n => n === payload.name) == null) {
            return lastState;
        }
        lastState.expanded.splice(lastState.expanded.indexOf(payload.name));
        return lastState;
    }

    @Action
    public addCategory(lastState: LayersState, payload: AddCategoryPayload): LayersState {
        let group = lastState.categoriesGroups.find(g => g.type === payload.groupType);
        group.categories.push(payload.category);
        return lastState;
    }

    @Action
    public updateCategory(lastState: LayersState, payload: UpdateCategoryPayload): LayersState {
        let group = lastState.categoriesGroups.find(g => g.type === payload.groupType);
        let categories = group.categories;
        let categoryIndex = categories.indexOf(categories.find(c => c.name === payload.category.name));
        categories.splice(categoryIndex, 1, payload.category);
        return lastState;
    }

    @Action
    public removeCategory(lastState: LayersState, payload: RemoveCategoryPayload): LayersState {
        let group = lastState.categoriesGroups.find(g => g.type === payload.groupType);
        let categoryIndex = group.categories.indexOf(group.categories.find(c => c.name === payload.categoryName));
        group.categories.splice(categoryIndex, 1);
        return lastState;
    }

    @Action
    public setCategoryVisibility(lastState: LayersState, payload: SetCategoryVisibilityPayload): LayersState {
        let group = lastState.categoriesGroups.find(g => g.type === payload.groupType);
        let category = group.categories.find(c => c.name === payload.name);
        category.visible = payload.visible;
        return lastState;
    }

    @Action
    public setCategoriesGroupVisibility(lastState: LayersState, payload: SetCategoriesGroupVisibilityPayload): LayersState {
        let group = lastState.categoriesGroups.find(g => g.type === payload.groupType);
        for (let category of group.categories) {
            category.visible = payload.visible;
        }
        group.visible = payload.visible;
        return lastState;
    }

    @Action
    public toggleOffline(lastState: LayersState, payload: ToggleOfflinePayload): LayersState {
        let layer = payload.isOverlay
            ? lastState.overlays.find(b => b.key === payload.key)
            : lastState.baseLayers.find(b => b.key === payload.key);
        layer.isOfflineOn = !layer.isOfflineOn;
        return lastState;
    }
}
