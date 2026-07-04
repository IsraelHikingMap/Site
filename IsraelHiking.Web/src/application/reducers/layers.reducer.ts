import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";
import { orderBy } from "lodash-es";

import { initialState, POINTS_OF_INTEREST_CATEGORIES } from "./initial-state";
import type { LayersState, EditableLayer } from "../models";

export class AddBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public layerData: EditableLayer) { }
}

export class AddOverlayAction {
    public static type = this.prototype.constructor.name;
    constructor(public layerData: EditableLayer) { }
}

export class RemoveBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string) { }
}

export class RemoveOverlayAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string) { }
}

export class UpdateBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string, public layerData: EditableLayer) { }
}

export class UpdateOverlayAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string, public layerData: EditableLayer) { }
}

export class SelectBaseLayerAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string) { }
}

export class SetOverlaysVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public key: string, public visible: boolean) { }
}

export class HideAllOverlaysAction {
    public static type = this.prototype.constructor.name;
}

export class ExpandGroupAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string) { }
}

export class CollapseGroupAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string) { }
}

export class TogglePoisCategoriesVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor() { }
}

export class ToggleCategoryVisibilityAction {
    public static type = this.prototype.constructor.name;
    constructor(public name: string) { }
}

@State({
    name: "layersState",
    defaults: initialState.layersState
})
@Injectable()
export class LayersReducer {

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
            lastState.overlays = this.sort(lastState.overlays) as EditableLayer[];
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
            const visibleIndex = lastState.visibleOverlays.indexOf(action.key);
            if (visibleIndex !== -1) {
                lastState.visibleOverlays.splice(visibleIndex, 1);
            }
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
            lastState.overlays = this.sort(overlays) as EditableLayer[];
            const visibleIndex = lastState.visibleOverlays.indexOf(action.key);
            if (visibleIndex !== -1 && action.key !== action.layerData.key) {
                lastState.visibleOverlays.splice(visibleIndex, 1, action.layerData.key);
            }
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

    @Action(SetOverlaysVisibilityAction)
    public setOverlaysVisibility(ctx: StateContext<LayersState>, action: SetOverlaysVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const itemVisibile = lastState.visibleOverlays.find(n => n === action.key);
            if (itemVisibile == null && action.visible) {
                lastState.visibleOverlays.push(action.key);
            } else if (itemVisibile != null && !action.visible) {
                lastState.visibleOverlays.splice(lastState.visibleOverlays.indexOf(action.key), 1);
            }
            return lastState;
        }));
    }

    @Action(HideAllOverlaysAction)
    public hideAllOverlays(ctx: StateContext<LayersState>) {
        ctx.setState(produce(ctx.getState(), lastState => {
            lastState.visibleOverlays = [];
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
    public toggleCategoryVisibility(ctx: StateContext<LayersState>, action: ToggleCategoryVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            const visiblityItem = lastState.visiblePoisCategories.find(c => c === action.name);
            if (!visiblityItem) {
                lastState.visiblePoisCategories.push(action.name);
                return lastState;
            }
            lastState.visiblePoisCategories.splice(lastState.visiblePoisCategories.indexOf(visiblityItem), 1);
            return lastState;
        }));
    }

    @Action(TogglePoisCategoriesVisibilityAction)
    public togglePoisCategoriesVisibility(ctx: StateContext<LayersState>, _action: TogglePoisCategoriesVisibilityAction) {
        ctx.setState(produce(ctx.getState(), lastState => {
            if (lastState.visiblePoisCategories.length > 0) {
                lastState.visiblePoisCategories = [];
                return lastState;
            }
            lastState.visiblePoisCategories.push(...POINTS_OF_INTEREST_CATEGORIES.map(c => c.name));
            return lastState;
        }));
    }
}
