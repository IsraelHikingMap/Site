import undoable, { UndoableOptions } from "redux-undo";
import { Action, AbstractReducer, ReducerActions } from "@angular-redux2/store";

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
    static actions: ReducerActions<RoutesReducer>;

    @Action
    public addRoute(lastState: RouteData[], payload: AddRoutePayload): RouteData[] {
        lastState.push(payload.routeData);
        return lastState;
    }

    @Action
    public deleteRoute(lastState: RouteData[], payload: RoutePayload): RouteData[] {
        let routeToRemove = lastState.find(r => r.id === payload.routeId);
        lastState.splice(lastState.indexOf(routeToRemove), 1);
        return lastState;
    }

    @Action
    public changeProperties(lastState: RouteData[], payload: ChangeRoutePropertiesActionPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.name = payload.routeData.name;
        route.opacity = payload.routeData.opacity || route.opacity;
        route.weight = payload.routeData.weight || route.weight;
        route.color =  payload.routeData.color || route.color;
        route.description = payload.routeData.description || route.description;
        return lastState;
    }

    @Action
    public addPoi(lastState: RouteData[], payload: AddPrivatePoiPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.markers.push(payload.markerData);
        return lastState;
    }

    @Action
    public updatePoi(lastState: RouteData[], payload: UpdatePrivatePoiPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.markers.splice(payload.index, 1, payload.markerData);
        return lastState;
    }

    @Action
    public deletePoi(lastState: RouteData[], payload: DeletePrivatePoiPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.markers.splice(payload.index, 1);
        return lastState;
    }

    @Action
    public addSegment(lastState: RouteData[], payload: AddSegmentPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.segments.push(payload.segmentData);
        return lastState;
    }

    @Action
    public updateSegments(lastState: RouteData[], payload: UpdateSegmentsPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        if (payload.segmentsData.length === payload.indices.length) {
            for (let segmentIndex = 0; segmentIndex < payload.indices.length; segmentIndex++) {
                route.segments.splice(payload.indices[segmentIndex], 1, payload.segmentsData[segmentIndex]);
            }
        } else if (payload.segmentsData.length === 2 && payload.indices.length === 1) {
            route.segments.splice(payload.indices[0], 1, ...payload.segmentsData);
        } else if (payload.segmentsData.length === 1 && payload.indices.length === 2) {
            route.segments.splice(payload.indices[1], 1, payload.segmentsData[0]);
            route.segments.splice(payload.indices[0], 1);
        }
        return lastState;
    }

    @Action
    public replaceSegments(lastState: RouteData[], payload: ReplaceSegmentsPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.segments = payload.segmentsData;
        return lastState;
    }

    @Action
    public deleteSegment(lastState: RouteData[], payload: DeleteSegmentPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.segments.splice(payload.index, 1);
        return lastState;
    }

    @Action
    public changeEditState(lastState: RouteData[], payload: ChangeEditStatePayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.state = payload.state;
        return lastState;
    }

    @Action
    public changeVisibility(lastState: RouteData[], payload: ChangeVisibilityPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.state = payload.isVisible ? "ReadOnly" : "Hidden";
        return lastState;
    }

    @Action
    public replaceRoute(lastState: RouteData[], payload: ReplaceRoutePayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        let routeIndex = lastState.indexOf(route);
        lastState.splice(routeIndex, 1, payload.routeData);
        return lastState;
    }

    @Action
    public splitRoute(lastState: RouteData[], payload: SplitRoutePayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        lastState.splice(lastState.indexOf(route), 1, payload.routeData, payload.splitRouteData);
        return lastState;
    }

    @Action
    public mergeRoutes(lastState: RouteData[], payload: MergeRoutesPayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        let secondaryRoute = lastState.find(r => r.id === payload.secondaryRouteId);
        lastState.splice(lastState.indexOf(route), 1, payload.mergedRouteData);
        lastState.splice(lastState.indexOf(secondaryRoute), 1);
        return lastState;
    }

    @Action
    public clearPois(lastState: RouteData[], payload: RoutePayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.markers = [];
        return lastState;
    }

    @Action
    public clearPoisAndRoute(lastState: RouteData[], payload: RoutePayload): RouteData[] {
        let route = lastState.find(r => r.id === payload.routeId);
        route.segments = [];
        route.markers = [];
        return lastState;
    }

    @Action
    public deleteAllRoutes(_lastState: RouteData[]): RouteData[] {
        return [];
    }

    @Action
    public toggleAllRoutes(lastState: RouteData[]): RouteData[] {
        let isAllRoutesHidden = lastState.find(r => r.state !== "Hidden") == null;
        for (let route of lastState) {
            route.state = isAllRoutesHidden ? "ReadOnly" : "Hidden";
        }
        return lastState;
    }

    @Action
    public replaceRoutes(_lastState: RouteData[], payload: BulkReplaceRoutesPayload): RouteData[] {
        return payload.routesData;
    }
}

export const routesReducer = undoable(RoutesReducer.createReducer(initialState.routes.present),
    {
        limit: 20
    } as UndoableOptions
);
