import { State, Action, StateContext } from "@ngxs/store";
import { Injectable } from "@angular/core";
import { produce } from "immer";

import { initialState } from "./initial-state";
import type { RouteData, MarkerData, RouteSegmentData, RouteEditStateType, StateWithHistory } from "../models";

export class UndoAction {
    public static readonly type = "[Routes] UndoAction";
}

export class RedoAction {
    public static readonly type = "[Routes] RedoAction";
}

export class ClearHistoryAction {
    public static readonly type = "[Routes] ClearHistoryAction";
}

export class RestoreHistoryAction {
    public static readonly type = "[Routes] RestoreHistoryAction";
    constructor(public readonly history: RouteData[][]) { }
}

export class AddRouteAction {
    public static readonly type = "[Routes] AddRouteAction";
    constructor(public readonly routeData: RouteData) { }
}

export class DeleteRouteAction {
    public static readonly type = "[Routes] DeleteRouteAction";
    constructor(public readonly routeId: string) { }
}

export class ChangeRoutePropertiesAction {
    public static readonly type = "[Routes] ChangeRoutePropertiesAction";
    constructor(public readonly routeId: string, public readonly routeData: RouteData) { }
}

export class AddPrivatePoiAction {
    public static readonly type = "[Routes] AddPrivatePoiAction";
    constructor(public readonly routeId: string, public readonly markerData: MarkerData) { }
}

export class UpdatePrivatePoiAction {
    public static readonly type = "[Routes] UpdatePrivatePoiAction";
    constructor(public readonly routeId: string, public readonly index: number, public readonly markerData: MarkerData) { }
}

export class DeletePrivatePoiAction {
    public static readonly type = "[Routes] DeletePrivatePoiAction";
    constructor(public readonly routeId: string, public readonly index: number) { }
}

export class DeletePrivatePoiByIdAction {
    public static readonly type = "[Routes] DeletePrivatePoiByIdAction";
    constructor(public readonly id: string) { }
}

export class AddSegmentAction {
    public static readonly type = "[Routes] AddSegmentAction";
    constructor(public readonly routeId: string, public readonly segmentData: RouteSegmentData) { }
}

export class UpdateSegmentsAction {
    public static readonly type = "[Routes] UpdateSegmentsAction";
    constructor(public readonly routeId: string, public readonly indices: number[], public readonly segmentsData: RouteSegmentData[]) { }
}

export class ReplaceSegmentsAction {
    public static readonly type = "[Routes] ReplaceSegmentsAction";
    constructor(public readonly routeId: string, public readonly segmentsData: RouteSegmentData[]) { }
}

export class DeleteSegmentAction {
    public static readonly type = "[Routes] DeleteSegmentAction";
    constructor(public readonly routeId: string, public readonly index: number) { }
}

export class ChangeRouteStateAction {
    public static readonly type = "[Routes] ChangeRouteStateAction";
    constructor(public readonly routeId: string, public readonly state: RouteEditStateType) { }
}

export class ReplaceRouteAction {
    public static readonly type = "[Routes] ReplaceRouteAction";
    constructor(public readonly routeId: string, public readonly routeData: RouteData) { }
}

export class SplitRouteAction {
    public static readonly type = "[Routes] SplitRouteAction";
    constructor(public readonly routeId: string, public readonly routeData: RouteData, public readonly splitRouteData: RouteData) { }
}

export class MergeRoutesAction {
    public static readonly type = "[Routes] MergeRoutesAction";
    constructor(public readonly routeId: string, public readonly secondaryRouteId: string, public readonly mergedRouteData: RouteData) { }
}

export class BulkReplaceRoutesAction {
    public static readonly type = "[Routes] BulkReplaceRoutesAction";
    constructor(public readonly routesData: RouteData[]) { }
}

export class ClearPoisAction {
    public static readonly type = "[Routes] ClearPoisAction";
    constructor(public readonly routeId: string) { }
}

export class ClearPoisAndRouteAction {
    public static readonly type = "[Routes] ClearPoisAndRouteAction";
    constructor(public readonly routeId: string) { }
}

export class DeleteAllRoutesAction {
    public static readonly type = "[Routes] DeleteAllRoutesAction";
}

export class ToggleAllRoutesAction {
    public static readonly type = "[Routes] ToggleAllRoutesAction";
}

@State<StateWithHistory<RouteData[]>>({
    name: "routes",
    defaults: initialState.routes
})
@Injectable()
export class RoutesReducer {

    private changeState(ctx: StateContext<StateWithHistory<RouteData[]>>, mutate: (current: RouteData[]) => RouteData[]) {
        ctx.setState(produce((lastState: StateWithHistory<RouteData[]>) => {
            lastState.past.push(lastState.present);
            if (lastState.past.length > 20) {
                lastState.past.splice(0, 1);
            }
            lastState.present = produce(lastState.present, (current) => mutate(current));
            lastState.future = [];
        }));
    }

    @Action(UndoAction)
    public undo(ctx: StateContext<StateWithHistory<RouteData[]>>) {
        ctx.setState(produce((lastState: StateWithHistory<RouteData[]>) => {
            if (lastState.past.length > 0) {
                lastState.future.push(lastState.present);
                const top = lastState.past.pop() as RouteData[];
                lastState.present = top;
            }
        }));
    }

    @Action(RedoAction)
    public redo(ctx: StateContext<StateWithHistory<RouteData[]>>) {
        ctx.setState(produce((lastState: StateWithHistory<RouteData[]>) => {
            if (lastState.future.length > 0) {
                lastState.past.push(lastState.present);
                const top = lastState.future.pop() as RouteData[];
                lastState.present = top;
            }
        }));
    }

    @Action(ClearHistoryAction)
    public clearHistory(ctx: StateContext<StateWithHistory<RouteData[]>>) {
        ctx.setState(produce((lastState: StateWithHistory<RouteData[]>) => {
            lastState.past = [];
            lastState.future = [];
        }));
    }

    @Action(RestoreHistoryAction)
    public restoreHistory(ctx: StateContext<StateWithHistory<RouteData[]>>, action: RestoreHistoryAction) {
        ctx.setState(produce((lastState: StateWithHistory<RouteData[]>) => {
            lastState.past = action.history;
        }));
    }

    @Action(AddRouteAction)
    public addRoute(ctx: StateContext<StateWithHistory<RouteData[]>>, action: AddRouteAction) {
        this.changeState(ctx, (lastState) => {
            lastState.unshift(action.routeData);
            return lastState;
        });
    }

    @Action(DeleteRouteAction)
    public deleteRoute(ctx: StateContext<StateWithHistory<RouteData[]>>, action: DeleteRouteAction) {
        this.changeState(ctx, (lastState) => {
            const routeToRemove = lastState.find(r => r.id === action.routeId);
            lastState.splice(lastState.indexOf(routeToRemove), 1);
            return lastState;
        });
    }

    @Action(ChangeRoutePropertiesAction)
    public changeProperties(ctx: StateContext<StateWithHistory<RouteData[]>>, action: ChangeRoutePropertiesAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.name = action.routeData.name;
            route.opacity = action.routeData.opacity == null ? route.opacity : action.routeData.opacity;
            route.weight = action.routeData.weight || route.weight;
            route.color = action.routeData.color || route.color;
            route.description = action.routeData.description || route.description;
            return lastState;
        });
    }

    @Action(AddPrivatePoiAction)
    public addPoi(ctx: StateContext<StateWithHistory<RouteData[]>>, action: AddPrivatePoiAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.markers.push(action.markerData);
            return lastState;
        });
    }

    @Action(UpdatePrivatePoiAction)
    public updatePoi(ctx: StateContext<StateWithHistory<RouteData[]>>, action: UpdatePrivatePoiAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.markers.splice(action.index, 1, action.markerData);
            return lastState;
        });
    }

    @Action(DeletePrivatePoiAction)
    public deletePoi(ctx: StateContext<StateWithHistory<RouteData[]>>, action: DeletePrivatePoiAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.markers.splice(action.index, 1);
            return lastState;
        });
    }

    @Action(DeletePrivatePoiByIdAction)
    public deletePoiById(ctx: StateContext<StateWithHistory<RouteData[]>>, action: DeletePrivatePoiByIdAction) {
        this.changeState(ctx, (lastState) => {
            for (const route of lastState) {
                const index = route.markers.findIndex(m => m.id === action.id);
                if (index !== -1) {
                    route.markers.splice(index, 1);
                    break;
                }
            }
            return lastState;
        });
    }

    @Action(AddSegmentAction)
    public addSegment(ctx: StateContext<StateWithHistory<RouteData[]>>, action: AddSegmentAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.segments.push(action.segmentData);
            return lastState;
        });
    }

    @Action(UpdateSegmentsAction)
    public updateSegments(ctx: StateContext<StateWithHistory<RouteData[]>>, action: UpdateSegmentsAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            if (action.segmentsData.length === action.indices.length) {
                for (let segmentIndex = 0; segmentIndex < action.indices.length; segmentIndex++) {
                    route.segments.splice(action.indices[segmentIndex], 1, action.segmentsData[segmentIndex]);
                }
            } else if (action.segmentsData.length === 2 && action.indices.length === 1) {
                route.segments.splice(action.indices[0], 1, ...action.segmentsData);
            } else if (action.segmentsData.length === 1 && action.indices.length === 2) {
                route.segments.splice(action.indices[1], 1, action.segmentsData[0]);
                route.segments.splice(action.indices[0], 1);
            }
            return lastState;
        });
    }

    @Action(ReplaceSegmentsAction)
    public replaceSegments(ctx: StateContext<StateWithHistory<RouteData[]>>, action: ReplaceSegmentsAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.segments = action.segmentsData;
            return lastState;
        });
    }

    @Action(DeleteSegmentAction)
    public deleteSegment(ctx: StateContext<StateWithHistory<RouteData[]>>, action: DeleteSegmentAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.segments.splice(action.index, 1);
            return lastState;
        });
    }

    @Action(ChangeRouteStateAction)
    public changeEditState(ctx: StateContext<StateWithHistory<RouteData[]>>, action: ChangeRouteStateAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.state = action.state;
            return lastState;
        });
    }

    @Action(ReplaceRouteAction)
    public replaceRoute(ctx: StateContext<StateWithHistory<RouteData[]>>, action: ReplaceRouteAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            const routeIndex = lastState.indexOf(route);
            lastState.splice(routeIndex, 1, action.routeData);
            return lastState;
        });
    }

    @Action(SplitRouteAction)
    public splitRoute(ctx: StateContext<StateWithHistory<RouteData[]>>, action: SplitRouteAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            lastState.splice(lastState.indexOf(route), 1, action.routeData, action.splitRouteData);
            return lastState;
        });
    }

    @Action(MergeRoutesAction)
    public mergeRoutes(ctx: StateContext<StateWithHistory<RouteData[]>>, action: MergeRoutesAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            const secondaryRoute = lastState.find(r => r.id === action.secondaryRouteId);
            lastState.splice(lastState.indexOf(route), 1, action.mergedRouteData);
            lastState.splice(lastState.indexOf(secondaryRoute), 1);
            return lastState;
        });
    }

    @Action(ClearPoisAction)
    public clearPois(ctx: StateContext<StateWithHistory<RouteData[]>>, action: ClearPoisAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.markers = [];
            return lastState;
        });
    }

    @Action(ClearPoisAndRouteAction)
    public clearPoisAndRoute(ctx: StateContext<StateWithHistory<RouteData[]>>, action: ClearPoisAndRouteAction) {
        this.changeState(ctx, (lastState) => {
            const route = lastState.find(r => r.id === action.routeId);
            route.segments = [];
            route.markers = [];
            return lastState;
        });
    }

    @Action(DeleteAllRoutesAction)
    public deleteAllRoutes(ctx: StateContext<StateWithHistory<RouteData[]>>) {
        this.changeState(ctx, (_) => []);
    }

    @Action(ToggleAllRoutesAction)
    public toggleAllRoutes(ctx: StateContext<StateWithHistory<RouteData[]>>) {
        this.changeState(ctx, (lastState) => {
            const isAllRoutesHidden = lastState.find(r => r.state !== "Hidden") == null;
            for (const route of lastState) {
                route.state = isAllRoutesHidden ? "ReadOnly" : "Hidden";
            }
            return lastState;
        });
    }

    @Action(BulkReplaceRoutesAction)
    public replaceRoutes(ctx: StateContext<StateWithHistory<RouteData[]>>, action: BulkReplaceRoutesAction) {
        this.changeState(ctx, (_) => action.routesData);

    }
}
