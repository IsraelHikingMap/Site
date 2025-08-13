import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";
import { orderBy, remove } from "lodash-es";

import { initialState, SPECIAL_LAYERS } from "./initial-state";
import type { LayersState, EditableLayer, Overlay, CategoriesGroupType, Category } from "../models";

export class AddBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public layerData: EditableLayer) {}
}

export class AddOverlayAction {
    public static type = this.prototype.constructor.name;
    constructor(public layerData: Overlay) {}
}

export class RemoveBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string) {}
}

export class RemoveOverlayAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string) {}
}

export class UpdateBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string, public layerData: EditableLayer) {}
}

export class UpdateOverlayAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string, public layerData: Overlay) {}
}

export class SelectBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string) {}
}

export class ExpandGroupAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string) {}
}

export class CollapseGroupAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string) {}
}

export class SetCategoriesGroupVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public groupType: CategoriesGroupType, public visible: boolean) {}
}

export class AddCategoryAction {
    public static type = this.prototype.constructor.name;
    constructor(public groupType: CategoriesGroupType, public category: Category) {}
}

export class UpdateCategoryAction {
    public static type = this.prototype.constructor.name;
    constructor(public groupType: CategoriesGroupType, public category: Category) {}
}

export class RemoveCategoryAction {
    public static type = this.prototype.constructor.name;
    constructor(public groupType: CategoriesGroupType, public categoryName: string) {}
}

export class SetCategoryVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string, public groupType: CategoriesGroupType, public visible: boolean) {}
}

export class ToggleOfflineAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string, public isOverlay: boolean) {}
}
@State({
    name: "layersState",
    defaults: initialState.layersState
})
@Injectable()
export class LayersReducer{

    private sort(layers: EditableLayer[]): EditableLayer[] {
        let ordered = orderBy(layers, l => l.key);
        const removed = remove(ordered, o => SPECIAL_LAYERS.indexOf(o.key) !== -1);
        ordered = [...removed, ...ordered];
        return ordered;
    }

    @Action(AddBaseLayerAction)
    public addBaseLayer(ctx: StateContext<LayersState>, action: AddBaseLayerAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.baseLayers.push(action.layerData);
            lastState.baseLayers = this.sort(lastState.baseLayers);
            return lastState;
        }));
    }

    @Action(AddOverlayAction)
    public addOverlay(ctx: StateContext<LayersState>, action: AddOverlayAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.overlays.push(action.layerData);
            lastState.overlays = this.sort(lastState.overlays) as Overlay[];
            return lastState;
        }));
    }

    @Action(RemoveBaseLayerAction)
    public removeBaseLayer(ctx: StateContext<LayersState>, action: RemoveBaseLayerAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const baseLayers = lastState.baseLayers;
            baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === action.key)), 1);
            return lastState;
        }));
    }

    @Action(RemoveOverlayAction)
    public removeOverlay(ctx: StateContext<LayersState>, action: RemoveOverlayAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const overlays = lastState.overlays;
            overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.key)), 1);
            return lastState;
        }));
    }

    @Action(UpdateBaseLayerAction)
    public updateBaseLayer(ctx: StateContext<LayersState>, action: UpdateBaseLayerAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const baseLayers = lastState.baseLayers;
            baseLayers.splice(baseLayers.indexOf(baseLayers.find(b => b.key === action.key)), 1, action.layerData);
            lastState.baseLayers = this.sort(baseLayers);
            return lastState;
        }));
    }

    @Action(UpdateOverlayAction)
    public updateOverlay(ctx: StateContext<LayersState>, action: UpdateOverlayAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const overlays = lastState.overlays;
            overlays.splice(overlays.indexOf(overlays.find(o => o.key === action.key)), 1, action.layerData);
            lastState.overlays = this.sort(overlays) as Overlay[];
            return lastState;
        }));
    }

    @Action(SelectBaseLayerAction)
    public selectBaseLayer(ctx: StateContext<LayersState>, action: SelectBaseLayerAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.selectedBaseLayerKey = action.key;
            return lastState;
        }));
    }

    @Action(ExpandGroupAction)
    public expandGroup(ctx: StateContext<LayersState>, action: ExpandGroupAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.expanded.find(n => n === action.name) != null) {
                return lastState;
            }
            lastState.expanded.push(action.name);
            return lastState;
        }));
    }

    @Action(CollapseGroupAction)
    public collapseGroup(ctx: StateContext<LayersState>, action: CollapseGroupAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.expanded.find(n => n === action.name) == null) {
                return lastState;
            }
            lastState.expanded.splice(lastState.expanded.indexOf(action.name));
            return lastState;
        }));
    }

    @Action(AddCategoryAction)
    public addCategory(ctx: StateContext<LayersState>, action: AddCategoryAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const group = lastState.categoriesGroups.find(g => g.type === action.groupType);
            group.categories.push(action.category);
            return lastState;
        }));
    }

    @Action(UpdateCategoryAction)
    public updateCategory(ctx: StateContext<LayersState>, action: UpdateCategoryAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const group = lastState.categoriesGroups.find(g => g.type === action.groupType);
            const categories = group.categories;
            const categoryIndex = categories.indexOf(categories.find(c => c.name === action.category.name));
            categories.splice(categoryIndex, 1, action.category);
            return lastState;
        }));
    }

    @Action(RemoveCategoryAction)
    public removeCategory(ctx: StateContext<LayersState>, action: RemoveCategoryAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const group = lastState.categoriesGroups.find(g => g.type === action.groupType);
            const categoryIndex = group.categories.indexOf(group.categories.find(c => c.name === action.categoryName));
            group.categories.splice(categoryIndex, 1);
            return lastState;
        }));
    }

    @Action(SetCategoryVisibilityAction)
    public setCategoryVisibility(ctx: StateContext<LayersState>, action: SetCategoryVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const group = lastState.categoriesGroups.find(g => g.type === action.groupType);
            const category = group.categories.find(c => c.name === action.name);
            category.visible = action.visible;
            group.visible = group.categories.some(c => c.visible);
            return lastState;
        }));
    }

    @Action(SetCategoriesGroupVisibilityAction)
    public setCategoriesGroupVisibility( ctx: StateContext<LayersState>, action: SetCategoriesGroupVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const group = lastState.categoriesGroups.find(g => g.type === action.groupType);
            for (const category of group.categories) {
                category.visible = action.visible;
            }
            group.visible = action.visible;
            return lastState;
        }));
    }

    @Action(ToggleOfflineAction)
    public toggleOffline( ctx: StateContext<LayersState>, action: ToggleOfflineAction){
        ctx.setState(produce(ctx.getState(), lastState => {
            const layer = action.isOverlay
                ? lastState.overlays.find(b => b.key === action.key)
                : lastState.baseLayers.find(b => b.key === action.key);
            layer.isOfflineOn = !layer.isOfflineOn;
            return lastState;
        }));
    }
}
