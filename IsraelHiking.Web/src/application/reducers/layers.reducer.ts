import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";
import { orderBy } from "lodash-es";

import { CATEGORIES_GROUPS, initialState } from "./initial-state";
import type { LayersState, EditableLayer, Overlay, CategoriesGroupType } from "../models";

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

export class ToggleCategoriesGroupVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public groupType: CategoriesGroupType) {}
}

export class ToggleCategoryVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string, public groupType: CategoriesGroupType) {}
}

@State({
    name: "layersState",
    defaults: initialState.layersState
})
@Injectable()
export class LayersReducer{

    private sort(layers: EditableLayer[]): EditableLayer[] {
        return orderBy(layers, l => l.key);
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

    @Action(ToggleCategoryVisibilityAction)
    public setCategoryVisibility(ctx: StateContext<LayersState>, action: ToggleCategoryVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const visiblityItem = lastState.visibleCategories.find(c => c.name === action.name && c.groupType === action.groupType);
            if (!visiblityItem) {
                lastState.visibleCategories.push({ name: action.name, groupType: action.groupType });
                return lastState;
            }
            lastState.visibleCategories.splice(lastState.visibleCategories.indexOf(visiblityItem), 1);
            return lastState;
        }));
    }

    @Action(ToggleCategoriesGroupVisibilityAction)
    public setCategoriesGroupVisibility(ctx: StateContext<LayersState>, action: ToggleCategoriesGroupVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.visibleCategories.some(g => g.groupType === action.groupType)) {
                lastState.visibleCategories = lastState.visibleCategories.filter(c => c.groupType !== action.groupType);
                return lastState;
            }
            const names = CATEGORIES_GROUPS.find(g => g.type === action.groupType).categories.map(c => c.name);
            for (const name of names) {
                lastState.visibleCategories.push({ name, groupType: action.groupType });
            }
            return lastState;
        }));
    }
}
