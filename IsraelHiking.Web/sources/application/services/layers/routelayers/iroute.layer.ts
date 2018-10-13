import { Injector, ComponentFactoryResolver } from "@angular/core";
import { Subject } from "rxjs";
import { MatDialog } from "@angular/material";

import { MapService } from "../../map.service";
import { RouterService } from "../../routers/router.service";
import { SnappingService, ISnappingRouteResponse, ISnappingPointResponse } from "../../snapping.service";
import { GeoLocationService } from "../../geo-location.service";
import { ElevationProvider } from "../../elevation.provider";
import {
    LatLngAlt,
    RouteSegmentData,
    MarkerData,
    RoutingType,
    ILatLngTime,
    RouteData,
    IMarkerWithTitle,
    IBounds,
    RouteStateName
} from
    "../../../models/models";

export interface IRouteSegment extends RouteSegmentData {
    routePointMarker: L.Marker;
    polyline: L.Polyline;
}

export interface IMarkerWithData extends MarkerData {
    marker: IMarkerWithTitle;
}

export interface IRouteProperties {
    name: string;
    description: string;
    pathOptions: L.PathOptions;
    currentRoutingType: RoutingType;
    isRoutingPerPoint: boolean;
    isVisible: boolean;
    isRecording: boolean;
}

export interface IRoute {
    segments: IRouteSegment[];
    markers: IMarkerWithData[];
    properties: IRouteProperties;
}

export interface ISnappingForRouteResponse {
    latlng: LatLngAlt;
    isSnapToSelfRoute: boolean;
}

export interface IRouteLayer {
    route: IRoute;
    mapService: MapService;
    snappingService: SnappingService;
    routerService: RouterService;
    elevationProvider: ElevationProvider;
    injector: Injector;
    matDialog: MatDialog;
    componentFactoryResolver: ComponentFactoryResolver;
    geoLocationService: GeoLocationService;

    dataChanged: Subject<any>;
    polylineHovered: Subject<LatLngAlt>;

    setRoutingType(routingType: RoutingType): void;
    setRouteProperties(properties: IRouteProperties): void;
    reverse(): void;
    undo(): void;
    isUndoDisabled(): boolean;
    clear(): void;
    getStateName(): RouteStateName;
    setState(stateName: RouteStateName): void;
    snapToSelf(latlng: LatLngAlt): ISnappingRouteResponse;
    getSnappingForRoute(latlng: LatLngAlt, isSnapToSelf?: boolean): ISnappingForRouteResponse;
    getSnappingForPoint(latlng: LatLngAlt): ISnappingPointResponse;
    raiseDataChanged(): void;
    getData(): RouteData;
    setData(data: RouteData): void;
    getBounds(): IBounds;
    makeAllPointsEditable(): void;

    getLastSegment(): IRouteSegment;
    getLastLatLng(): ILatLngTime;

    setHiddenState(): void;
    setReadOnlyState(): void;
    setEditRouteState(): void;
    setEditPoiState(): void;
}