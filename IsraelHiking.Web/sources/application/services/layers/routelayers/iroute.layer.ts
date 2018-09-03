import { Injector, ComponentFactoryResolver } from "@angular/core";
import { Subject } from "rxjs";
import { RouteStateName } from "./iroute-state";
import { MapService } from "../../map.service";
import { RouterService } from "../../routers/router.service";
import { SnappingService, ISnappingRouteResponse, ISnappingPointResponse } from "../../snapping.service";
import { GeoLocationService } from "../../geo-location.service";
import { ElevationProvider } from "../../elevation.provider";
import * as Common from "../../../common/IsraelHiking";

export interface IRouteSegment extends Common.RouteSegmentData {
    routePointMarker: L.Marker;
    polyline: L.Polyline;
}

export interface IMarkerWithData extends Common.MarkerData {
    marker: Common.IMarkerWithTitle;
}

export interface IRouteProperties {
    name: string;
    description: string;
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

export interface ISnappingForRouteResponse {
    latlng: L.LatLng;
    isSnapToSelfRoute: boolean;
}

export interface IRouteLayer {
    route: IRoute;
    mapService: MapService;
    snappingService: SnappingService;
    routerService: RouterService;
    elevationProvider: ElevationProvider;
    injector: Injector;
    componentFactoryResolver: ComponentFactoryResolver;
    geoLocationService: GeoLocationService;

    dataChanged: Subject<any>;
    polylineHovered: Subject<L.LatLng>;

    setRoutingType(routingType: Common.RoutingType): void;
    setRouteProperties(properties: IRouteProperties): void;
    reverse(): void;
    undo(): void;
    isUndoDisabled(): boolean;
    clear(): void;
    getStateName(): RouteStateName;
    setState(stateName: RouteStateName): void;
    snapToSelf(latlng: L.LatLng): ISnappingRouteResponse;
    getSnappingForRoute(latlng: L.LatLng, isSnapToSelf?: boolean): ISnappingForRouteResponse;
    getSnappingForPoint(latlng: L.LatLng): ISnappingPointResponse;
    raiseDataChanged(): void;
    getData(): Common.RouteData;
    setData(data: Common.RouteData): void;
    getBounds(): L.LatLngBounds;
    makeAllPointsEditable(): void;

    getLastSegment(): IRouteSegment;
    getLastLatLng(): Common.ILatLngTime;

    setHiddenState(): void;
    setReadOnlyState(): void;
    setEditRouteState(): void;
    setEditPoiState(): void;
    setRecordingState(): void;
    setRecordingPoiState(): void;
}