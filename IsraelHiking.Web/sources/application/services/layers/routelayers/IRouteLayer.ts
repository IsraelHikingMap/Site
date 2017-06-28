import { Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Subject } from "rxjs/Subject";
import { IRouteState, EditMode } from "./IRouteState";
import { MapService } from "../../MapService";
import { RouterService } from "../../routers/RouterService";
import { SnappingService } from "../../SnappingService";
import { ElevationProvider } from "../../ElevationProvider";
import { ISnappingResponse } from "../../SnappingService"
import * as Common from "../../../common/IsraelHiking";

export namespace EditModeString {
    export const poi: EditMode = "POI";
    export const none: EditMode = "None";
    export const route: EditMode = "Route";
}

export interface IRouteSegment extends Common.RouteSegmentData {
    routePointMarker: L.Marker;
    polyline: L.Polyline;
}

export interface IMarkerWithData extends Common.MarkerData {
    marker: Common.IMarkerWithTitle;
}

export interface IRouteProperties {
    name: string;
    pathOptions: L.PathOptions;
    currentRoutingType: Common.RoutingType;
    isRoutingPerPoint: boolean;
    isVisible: boolean;
}

export interface IRoute {
    segments: IRouteSegment[];
    markers: IMarkerWithData[];
    properties: IRouteProperties;
}

export interface IRouteLayer {
    route: IRoute;
    mapService: MapService;
    snappingService: SnappingService;
    routerService: RouterService;
    elevationProvider: ElevationProvider;
    injector: Injector;
    componentFactoryResolver: ComponentFactoryResolver;
    applicationRef: ApplicationRef;

    dataChanged: Subject<any>;
    polylineHovered: Subject<L.LatLng>;

    clearCurrentState(): void;
    setState(routeState: IRouteState): void;
    setRoutingType(routingType: Common.RoutingType): void;
    setRouteProperties(properties: IRouteProperties): void;
    reverse(): void;
    undo(): void;
    isUndoDisbaled(): boolean;
    clear(): void;
    getEditMode(): EditMode;
    snapToRoute(latlng: L.LatLng): ISnappingResponse;
    raiseDataChanged(): void;
    getData(): Common.RouteData;
    getBounds(): L.LatLngBounds;

    setHiddenState(): void;
    setReadOnlyState(): void;
    setEditRouteState(): void;
    setEditPoiState(): void;
}