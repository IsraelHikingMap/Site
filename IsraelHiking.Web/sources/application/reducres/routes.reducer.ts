import undoable, { UndoableOptions, includeAction } from "redux-undo";

import { RouteData, MarkerData, RouteSegmentData, RouteStateName, ILatLngTime } from "../models/models";
import { initialState } from "./initial-state";
import { ReduxAction, createReducerFromClass, BaseAction } from "./reducer-action-decorator";


const ADD_ROUTE = "ADD_ROUTE";
const DELETE_ROUTE = "DELETE_ROUTE";
const CHANGE_PROPERTIES = "CHANGE_PROPERTIES";
const ADD_POI = "ADD_POI";
const UPDATE_POI = "UPDATE_POI";
const DELETE_POI = "DELETE_POI";
const ADD_SEGMENT = "ADD_SEGMENT";
const UPDATE_SEGMENTS = "UPDATE_SEGMENTS";
const REPLACE_SEGMENTS = "REPLACE_SEGMENTS";
const DELETE_SEGMENT = "DELETE_SEGMENT";
const CHANGE_EDIT_STATE = "CHANGE_EDIT_STATE";
const CHANGE_VISIBILITY = "CHANGE_VISIBILITY";
const REVERSE_ROUTE = "REVERSE_ROUTE";
const SPLIT_ROUTE = "SPLIT_ROUTE";
const MERGE_ROUTES = "MERGE_ROUTES";
const ADD_RECORDING_POINT = "ADD_RECORDING_POINT";
const STOP_RECORDING = "STOP_RECORDING";
const CLEAR_POIS = "CLEAR_POIS";
const CLEAR_POIS_AND_ROUTE = "CLEAR_POIS_AND_ROUTE";

export interface RoutePayload {
    routeId: string;
}

export interface AddRoutePayload {
    routeData: RouteData;
}

export interface ChangeRoutePropertiesActionPayload extends RoutePayload {
    routeData: RouteData;
}

export interface AddPrivatePoiPayload extends RoutePayload {
    markerData: MarkerData;
}

export interface UpdatePrivatePoiPayload extends RoutePayload {
    index: number;
    markerData: MarkerData;
}

export interface DeletePrivatePoiPayload extends RoutePayload {
    index: number;
}

export interface AddSegmentPayload extends RoutePayload {
    segmentData: RouteSegmentData;
}

export interface UpdateSegmentsPayload extends RoutePayload {
    indices: number[];
    segmentsData: RouteSegmentData[];
}

export interface ReplaceSegmentsPayload extends RoutePayload {
    segmentsData: RouteSegmentData[];
}

export interface DeleteSegmentPayload extends RoutePayload {
    index: number;
}

export interface ChangeVisibilityPayload extends RoutePayload {
    isVisible: boolean;
}

export interface ChangeEditStatePayload extends RoutePayload {
    state: RouteStateName;
}

export interface ReverseRoutePayload extends RoutePayload {
    routeData: RouteData;
}

export interface SplitRoutePayload extends RoutePayload {
    routeData: RouteData;
    splitRouteData: RouteData;
}

export interface MergeRoutesPayload extends RoutePayload {
    secondaryRouteId: string;
    mergedRouteData: RouteData;
}

export interface AddRecordingPointPayload extends RoutePayload {
    latlng: ILatLngTime;
}

export class AddRouteAction extends BaseAction<AddRoutePayload> {
    constructor(payload: AddRoutePayload) {
        super(ADD_ROUTE, payload);
    }
}

export class DeleteRouteAction extends BaseAction<RoutePayload> {
    constructor(payload: RoutePayload) {
        super(DELETE_ROUTE, payload);
    }
}

export class ChangeRoutePropertiesAction extends BaseAction<ChangeRoutePropertiesActionPayload> {
    constructor(payload: ChangeRoutePropertiesActionPayload) {
        super(CHANGE_PROPERTIES, payload);
    }
}

export class AddPrivatePoiAction extends BaseAction<AddPrivatePoiPayload> {
    constructor(payload: AddPrivatePoiPayload) {
        super(ADD_POI, payload);
    }
}

export class UpdatePrivatePoiAction extends BaseAction<UpdatePrivatePoiPayload> {
    constructor(payload: UpdatePrivatePoiPayload) {
        super(UPDATE_POI, payload);
    }
}

export class DeletePrivatePoiAction extends BaseAction<DeletePrivatePoiPayload> {
    constructor(payload: DeletePrivatePoiPayload) {
        super(DELETE_POI, payload);
    }
}

export class AddSegmentAction extends BaseAction<AddSegmentPayload> {
    constructor(payload: AddSegmentPayload) {
        super(ADD_SEGMENT, payload);
    }
}

export class UpdateSegmentsAction extends BaseAction<UpdateSegmentsPayload> {
    constructor(payload: UpdateSegmentsPayload) {
        super(UPDATE_SEGMENTS, payload);
    }
}

export class ReplaceSegmentsAction extends BaseAction<ReplaceSegmentsPayload> {
    constructor(payload: ReplaceSegmentsPayload) {
        super(REPLACE_SEGMENTS, payload);
    }
}

export class DeleteSegmentAction extends BaseAction<DeleteSegmentPayload> {
    constructor(payload: DeleteSegmentPayload) {
        super(DELETE_SEGMENT, payload);
    }
}

export class ChangeEditStateAction extends BaseAction<ChangeEditStatePayload> {
    constructor(payload: ChangeEditStatePayload) {
        super(CHANGE_EDIT_STATE, payload);
    }
}

export class ChangeVisibilityAction extends BaseAction<ChangeVisibilityPayload> {
    constructor(payload: ChangeVisibilityPayload) {
        super(CHANGE_VISIBILITY, payload);
    }
}

export class ReverseRouteAction extends BaseAction<ReverseRoutePayload> {
    constructor(payload: ReverseRoutePayload) {
        super(REVERSE_ROUTE, payload);
    }
}

export class SplitRouteAction extends BaseAction<SplitRoutePayload> {
    constructor(payload: SplitRoutePayload) {
        super(SPLIT_ROUTE, payload);
    }
}

export class MergeRoutesAction extends BaseAction<MergeRoutesPayload> {
    constructor(payload: MergeRoutesPayload) {
        super(MERGE_ROUTES, payload);
    }
}

export class AddRecordingPointAction extends BaseAction<AddRecordingPointPayload> {
    constructor(payload: AddRecordingPointPayload) {
        super(ADD_RECORDING_POINT, payload);
    }
}

export class StopRecordingAction extends BaseAction<RoutePayload> {
    constructor(payload: RoutePayload) {
        super(STOP_RECORDING, payload);
    }
}

export class ClearPoisAction extends BaseAction<RoutePayload> {
    constructor(payload: RoutePayload) {
        super(CLEAR_POIS, payload);
    }
}

export class ClearPoisAndRouteAction extends BaseAction<RoutePayload> {
    constructor(payload: RoutePayload) {
        super(CLEAR_POIS_AND_ROUTE, payload);
    }
}

class RoutesReducer {
    private doForRoute(lastState: RouteData[], routeId: string, updateAction: (route: RouteData) => RouteData): RouteData[] {
        let route = lastState.find(r => r.id === routeId);
        let routes = [...lastState];
        let updatedRoute = updateAction(route);
        routes.splice(routes.indexOf(route), 1, updatedRoute);
        return routes;
    }

    @ReduxAction(ADD_ROUTE)
    public addRoute(lastState: RouteData[], action: AddRouteAction): RouteData[] {
        return [...lastState, action.payload.routeData];
    }

    @ReduxAction(DELETE_ROUTE)
    public deleteRoute(lastState: RouteData[], action: DeleteRouteAction): RouteData[] {
        let routes = [...lastState];
        let routeToRemove = routes.find(r => r.id === action.payload.routeId);
        routes.splice(routes.indexOf(routeToRemove), 1);
        return routes;
    }

    @ReduxAction(CHANGE_PROPERTIES)
    public changeProperties(lastState: RouteData[], action: ChangeRoutePropertiesAction): RouteData[] {
        return this.doForRoute(lastState, action.payload.routeId,
            (route) =>
                ({
                    ...route,
                    name: action.payload.routeData.name,
                    opacity: action.payload.routeData.opacity || route.opacity,
                    weight: action.payload.routeData.weight || route.weight,
                    color: action.payload.routeData.color || route.color,
                    description: action.payload.routeData.description || route.description,
                } as RouteData));
    }

    @ReduxAction(ADD_POI)
    public addPoi(lastState: RouteData[], action: AddPrivatePoiAction): RouteData[] {
        return this.doForRoute(lastState, action.payload.routeId,
            (route) =>
                ({
                    ...route,
                    markers: [...route.markers, action.payload.markerData]
                } as RouteData));
    }

    @ReduxAction(UPDATE_POI)
    public updatePoi(lastState: RouteData[], action: UpdatePrivatePoiAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => {
                let markers = [...route.markers];
                markers.splice(action.payload.index, 1, action.payload.markerData);
                return {
                    ...route,
                    markers: markers
                } as RouteData;
            });
    }

    @ReduxAction(DELETE_POI)
    public deletePoi(lastState: RouteData[], action: DeletePrivatePoiAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => {
                let markers = [...route.markers];
                markers.splice(action.payload.index, 1);
                return {
                    ...route,
                    markers: markers
                } as RouteData;
            });
    }

    @ReduxAction(ADD_SEGMENT)
    public addSegment(lastState: RouteData[], action: AddSegmentAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) =>
                ({
                    ...route,
                    segments: [...route.segments, action.payload.segmentData]
                } as RouteData));
    }

    @ReduxAction(UPDATE_SEGMENTS)
    public updateSegment(lastState: RouteData[], action: UpdateSegmentsAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => {
                let segments = [...route.segments];
                if (action.payload.segmentsData.length === action.payload.indices.length) {
                    for (let segmentIndex = 0; segmentIndex < action.payload.indices.length; segmentIndex++) {
                        segments.splice(action.payload.indices[segmentIndex], 1, action.payload.segmentsData[segmentIndex]);
                    }
                } else if (action.payload.segmentsData.length === 2 && action.payload.indices.length === 1) {
                    segments.splice(action.payload.indices[0], 1, ...action.payload.segmentsData);
                } else if (action.payload.segmentsData.length === 1 && action.payload.indices.length === 2) {
                    segments.splice(action.payload.indices[1], 1, action.payload.segmentsData[0]);
                    segments.splice(action.payload.indices[0], 1);
                }
                return {
                    ...route,
                    segments: segments
                } as RouteData;
            });
    }

    @ReduxAction(REPLACE_SEGMENTS)
    public replaceSegments(lastState: RouteData[], action: ReplaceSegmentsAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => ({
                ...route,
                segments: action.payload.segmentsData
            } as RouteData
            ));
    }

    @ReduxAction(DELETE_SEGMENT)
    public deleteSegment(lastState: RouteData[], action: DeleteSegmentAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => {
                let segments = [...route.segments];
                segments.splice(action.payload.index, 1);
                return {
                    ...route,
                    segments: segments
                } as RouteData;
            });
    }

    @ReduxAction(CHANGE_EDIT_STATE)
    public changeEditState(lastState: RouteData[], action: ChangeEditStateAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) =>
                ({
                    ...route,
                    state: action.payload.state
                } as RouteData));
    }

    @ReduxAction(CHANGE_VISIBILITY)
    public changeVisibility(lastState: RouteData[], action: ChangeVisibilityAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) =>
                ({
                    ...route,
                    state: action.payload.isVisible ? "ReadOnly" : "Hidden"
                } as RouteData));
    }


    @ReduxAction(REVERSE_ROUTE)
    public reverseRoute(lastState: RouteData[], action: ReverseRouteAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            () => action.payload.routeData);
    }

    @ReduxAction(SPLIT_ROUTE)
    public splitRoute(lastState: RouteData[], action: SplitRouteAction): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        let routes = [...lastState];
        routes.splice(routes.indexOf(route), 1, action.payload.routeData, action.payload.splitRouteData);
        return routes;
    }

    @ReduxAction(MERGE_ROUTES)
    public mergeRoutes(lastState: RouteData[], action: MergeRoutesAction): RouteData[] {
        let route = lastState.find(r => r.id === action.payload.routeId);
        let secondaryRoute = lastState.find(r => r.id === action.payload.secondaryRouteId);
        let routes = [...lastState];
        routes.splice(routes.indexOf(route), 1, action.payload.mergedRouteData);
        routes.splice(routes.indexOf(secondaryRoute), 1);
        return routes;
    }

    @ReduxAction(ADD_RECORDING_POINT)
    public addRecordingPoint(lastState: RouteData[], action: AddRecordingPointAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => {
                let segments = [...route.segments];
                let lastSegment = { ...segments[segments.length - 1] };
                lastSegment.latlngs = [...lastSegment.latlngs, action.payload.latlng];
                lastSegment.routePoint = action.payload.latlng;
                segments.splice(segments.length - 1, 1, lastSegment);
                return {
                    ...route,
                    segments: segments
                };
            });
    }

    @ReduxAction(STOP_RECORDING)
    public stopRecording(lastState: RouteData[], action: StopRecordingAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => ({
                ...route,
                isRecording: false
            }));
    }

    @ReduxAction(CLEAR_POIS)
    public clearPois(lastState: RouteData[], action: ClearPoisAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => ({
                ...route,
                markers: []
            }));
    }

    @ReduxAction(CLEAR_POIS_AND_ROUTE)
    public clearPoisAndRoute(lastState: RouteData[], action: ClearPoisAndRouteAction): RouteData[] {
        return this.doForRoute(lastState,
            action.payload.routeId,
            (route) => ({
                ...route,
                markers: [],
                segments: []
            }));
    }
}

export const routesReducer = undoable(createReducerFromClass(RoutesReducer, initialState.routes.present),
    {
        filter: includeAction([
            ADD_ROUTE,
            DELETE_ROUTE,
            CHANGE_PROPERTIES,
            ADD_POI,
            UPDATE_POI,
            DELETE_POI,
            ADD_SEGMENT,
            UPDATE_SEGMENTS,
            REPLACE_SEGMENTS,
            DELETE_SEGMENT,
            CHANGE_VISIBILITY,
            REVERSE_ROUTE,
            SPLIT_ROUTE,
            MERGE_ROUTES,
            CLEAR_POIS,
            CLEAR_POIS_AND_ROUTE
        ]),
        limit: 20
    } as UndoableOptions);