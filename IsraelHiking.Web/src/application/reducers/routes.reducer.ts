import undoable, { UndoableOptions } from "redux-undo";
import { Action, AbstractReducer, AnyAction, ActionPayload } from "@angular-redux2/store";

import { initialState } from "./initial-state";
import type { RouteData, MarkerData, RouteSegmentData, RouteEditStateType } from "../models/models";

export type RoutePayload = {
    routeId: string;
};

export type AddRoutePayload = {
    routeData: RouteData;
};

export type ChangeRoutePropertiesActionPayload = RoutePayload & {
    routeData: RouteData;
};

export type AddPrivatePoiPayload = RoutePayload & {
    markerData: MarkerData;
};

export type UpdatePrivatePoiPayload = RoutePayload & {
    index: number;
    markerData: MarkerData;
};

export type DeletePrivatePoiPayload = RoutePayload & {
    index: number;
};

export type AddSegmentPayload = RoutePayload & {
    segmentData: RouteSegmentData;
};

export type UpdateSegmentsPayload = RoutePayload & {
    indices: number[];
    segmentsData: RouteSegmentData[];
};

export type ReplaceSegmentsPayload = RoutePayload & {
    segmentsData: RouteSegmentData[];
};

export type DeleteSegmentPayload = RoutePayload & {
    index: number;
};

export type ChangeVisibilityPayload = RoutePayload & {
    isVisible: boolean;
};

export type ChangeEditStatePayload = RoutePayload & {
    state: RouteEditStateType;
};

export type ReplaceRoutePayload = RoutePayload & {
    routeData: RouteData;
};

export type SplitRoutePayload = RoutePayload & {
    routeData: RouteData;
    splitRouteData: RouteData;
};

export type MergeRoutesPayload = RoutePayload & {
    secondaryRouteId: string;
    mergedRouteData: RouteData;
};

export type BulkReplaceRoutesPayload = {
    routesData: RouteData[];
};

export class RoutesReducer extends AbstractReducer {
    static actions: {
        addRoute: ActionPayload<AddRoutePayload>;
        deleteRoute: ActionPayload<RoutePayload>;
        changeProperties: ActionPayload<ChangeRoutePropertiesActionPayload>;
        addPoi: ActionPayload<AddPrivatePoiPayload>;
        updatePoi: ActionPayload<UpdatePrivatePoiPayload>;
        deletePoi: ActionPayload<DeletePrivatePoiPayload>;
        addSegment: ActionPayload<AddSegmentPayload>;
        updateSegments: ActionPayload<UpdateSegmentsPayload>;
        replaceSegments: ActionPayload<ReplaceSegmentsPayload>;
        deleteSegment: ActionPayload<DeleteSegmentPayload>;
        changeEditState: ActionPayload<ChangeEditStatePayload>;
        changeVisibility: ActionPayload<ChangeVisibilityPayload>;
        replaceRoute: ActionPayload<ReplaceRoutePayload>;
        splitRoute: ActionPayload<SplitRoutePayload>;
        mergeRoutes: ActionPayload<MergeRoutesPayload>;
        clearPois: ActionPayload<RoutePayload>;
        clearPoisAndRoute: ActionPayload<RoutePayload>;
        deleteAllRoutes: ActionPayload<any>;
        toggleAllRoutes: ActionPayload<any>;
        replaceRoutes: ActionPayload<BulkReplaceRoutesPayload>;
    };

    @Action
    public addRoute(lastState: RouteData[], action: AnyAction<AddRoutePayload>): RouteData[] {
        lastState.push(action.payload.routeData);
        return lastState;
    }

    @Action
    public deleteRoute(lastState: RouteData[], action: AnyAction<RoutePayload>): RouteData[] {
        let routeToRemove = lastState.find(r => r.id === action.payload.routeId);
        lastState.splice(lastState.indexOf(routeToRemove), 1);
        return lastState;
    }

    @Action
    public changeProperties(lastState: RouteData[], action: AnyAction<ChangeRoutePropertiesActionPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.name = action.payload.routeData.name;
        route.opacity = action.payload.routeData.opacity || route.opacity;
        route.weight = action.payload.routeData.weight || route.weight;
        route.color =  action.payload.routeData.color || route.color;
        route.description = action.payload.routeData.description || route.description;
        return lastState;
    }

    @Action
    public addPoi(lastState: RouteData[], action: AnyAction<AddPrivatePoiPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.markers.push(action.payload.markerData);
        return lastState;
    }

    @Action
    public updatePoi(lastState: RouteData[], action: AnyAction<UpdatePrivatePoiPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.markers.splice(action.payload.index, 1, action.payload.markerData);
        return lastState;
    }

    @Action
    public deletePoi(lastState: RouteData[], action: AnyAction<DeletePrivatePoiPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.markers.splice(action.payload.index, 1);
        return lastState;
    }

    @Action
    public addSegment(lastState: RouteData[], action: AnyAction<AddSegmentPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.segments.push(action.payload.segmentData);
        return lastState;
    }

    @Action
    public updateSegments(lastState: RouteData[], action: AnyAction<UpdateSegmentsPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        if (action.payload.segmentsData.length === action.payload.indices.length) {
            for (let segmentIndex = 0; segmentIndex < action.payload.indices.length; segmentIndex++) {
                route.segments.splice(action.payload.indices[segmentIndex], 1, action.payload.segmentsData[segmentIndex]);
            }
        } else if (action.payload.segmentsData.length === 2 && action.payload.indices.length === 1) {
            route.segments.splice(action.payload.indices[0], 1, ...action.payload.segmentsData);
        } else if (action.payload.segmentsData.length === 1 && action.payload.indices.length === 2) {
            route.segments.splice(action.payload.indices[1], 1, action.payload.segmentsData[0]);
            route.segments.splice(action.payload.indices[0], 1);
        }
        return lastState;
    }

    @Action
    public replaceSegments(lastState: RouteData[], action: AnyAction<ReplaceSegmentsPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.segments = action.payload.segmentsData;
        return lastState;
    }

    @Action
    public deleteSegment(lastState: RouteData[], action: AnyAction<DeleteSegmentPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.segments.splice(action.payload.index, 1);
        return lastState;
    }

    @Action
    public changeEditState(lastState: RouteData[], action: AnyAction<ChangeEditStatePayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.state = action.payload.state;
        return lastState;
    }

    @Action
    public changeVisibility(lastState: RouteData[], action: AnyAction<ChangeVisibilityPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.state = action.payload.isVisible ? "ReadOnly" : "Hidden";
        return lastState;
    }

    @Action
    public replaceRoute(lastState: RouteData[], action: AnyAction<ReplaceRoutePayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        let routeIndex = lastState.indexOf(route);
        lastState.splice(routeIndex, 1, action.payload.routeData);
        return lastState;
    }

    @Action
    public splitRoute(lastState: RouteData[], action: AnyAction<SplitRoutePayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        lastState.splice(lastState.indexOf(route), 1, action.payload.routeData, action.payload.splitRouteData);
        return lastState;
    }

    @Action
    public mergeRoutes(lastState: RouteData[], action: AnyAction<MergeRoutesPayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        let secondaryRoute = lastState.find(r => r.id === action.payload.secondaryRouteId);
        lastState.splice(lastState.indexOf(route), 1, action.payload.mergedRouteData);
        lastState.splice(lastState.indexOf(secondaryRoute), 1);
        return lastState;
    }

    @Action
    public clearPois(lastState: RouteData[], action: AnyAction<RoutePayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.markers = [];
        return lastState;
    }

    @Action
    public clearPoisAndRoute(lastState: RouteData[], action: AnyAction<RoutePayload>): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        route.segments = [];
        route.markers = [];
        return lastState;
    }

    @Action
    public deleteAllRoutes(_lastState: RouteData[], _action: AnyAction<any>): RouteData[] {
        return [];
    }

    @Action
    public toggleAllRoutes(lastState: RouteData[], _action: AnyAction<any>): RouteData[] {
        let isAllRoutesHidden = lastState.find(r => r.state !== "Hidden") == null;
        for (let route of lastState) {
            route.state = isAllRoutesHidden ? "ReadOnly" : "Hidden";
        }
        return lastState;
    }

    @Action
    public replaceRoutes(_lastState: RouteData[], action: AnyAction<BulkReplaceRoutesPayload>): RouteData[] {
        return action.payload.routesData;
    }
}

export const routesReducer = undoable(RoutesReducer.createReducer(initialState.routes.present),
    {
        limit: 20
    } as UndoableOptions
);
