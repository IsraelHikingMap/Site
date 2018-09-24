import { Injector, ComponentFactoryResolver } from "@angular/core";
import { Subject } from "rxjs";
import { MatDialog } from "@angular/material";
import * as L from "leaflet";

import { SnappingService, ISnappingRouteOptions, ISnappingRouteResponse, ISnappingPointResponse } from "../../snapping.service";
import { MapService } from "../../map.service";
import { RouterService } from "../../routers/router.service";
import { GeoLocationService } from "../../geo-location.service";
import { ElevationProvider } from "../../elevation.provider";
import { IRouteState, RouteStateName } from "./iroute-state";
import {
    IRouteLayer,
    IRoute,
    IRouteProperties,
    IRouteSegment,
    IMarkerWithData,
    ISnappingForRouteResponse
} from "./iroute.layer";
import { RouteStateBase } from "./route-state-base";
import { RouteStateReadOnly } from "./route-state-read-only";
import { RouteStateHidden } from "./route-state-hidden";
import { RouteStateEditPoi } from "./route-state-edit-poi";
import { RouteStateEditRoute } from "./route-state-edit-route";
import { UndoHandler } from "./undo-handler";
import * as Common from "../../../common/IsraelHiking";

export class RouteLayer extends L.Layer implements IRouteLayer {
    public route: IRoute;
    public dataChanged: Subject<any>;
    public polylineHovered: Subject<L.LatLng>;

    private currentState: IRouteState;
    private undoHandler: UndoHandler<Common.RouteData>;
    public map: L.Map;

    constructor(public readonly mapService: MapService,
        public readonly snappingService: SnappingService,
        public readonly routerService: RouterService,
        public readonly geoLocationService: GeoLocationService,
        public readonly elevationProvider: ElevationProvider,
        public readonly injector: Injector,
        public readonly matDialog: MatDialog,
        public readonly componentFactoryResolver: ComponentFactoryResolver,
        route: IRoute) {
        super();
        this.map = mapService.map;
        this.route = route;
        this.undoHandler = new UndoHandler<Common.RouteData>();
        this.undoHandler.addDataToUndoStack(this.getData());
        this.currentState = new RouteStateReadOnly(this);
        this.dataChanged = new Subject<any>();
        this.polylineHovered = new Subject<L.LatLng>();
    }

    public onAdd(map: L.Map): this {
        this.route.properties.isVisible = true;
        this.setReadOnlyState();
        return this;
    }

    public onRemove(map: L.Map): this {
        this.setHiddenState();
        this.route.properties.isVisible = false;
        return this;
    }

    public getStateName(): RouteStateName {
        return this.currentState.getStateName();
    }

    public setState(stateName: RouteStateName) {
        switch (stateName) {
            case "Poi":
                this.setEditPoiState();
                break;
            case "Route":
                this.setEditRouteState();
                break;
            case "Hidden":
                this.setHiddenState();
                break;
            case "ReadOnly":
                this.setReadOnlyState();
                break;
            default:
                throw new Error(`Invalid state: ${stateName}`);
        }
    }

    public setRouteProperties(properties: IRouteProperties) {
        this.route.properties = properties;
        this.currentState.clear();
        this.currentState.initialize();
        this.raiseDataChanged();
    }

    public snapToSelf(latlng: L.LatLng): ISnappingRouteResponse {
        let polylines = [];
        for (let segment of this.route.segments) {
            if (segment.polyline) {
                polylines.push(segment.polyline);
            } else {
                polylines.push(L.polyline(segment.latlngs));
            }
        }
        return this.snappingService.snapToRoute(latlng, {
            sensitivity: 30,
            polylines: polylines
        } as ISnappingRouteOptions);
    }

    public getSnappingForPoint(latlng: L.LatLng): ISnappingPointResponse {
        if (this.geoLocationService.getState() === "tracking") {
            let snappingPointResponse = this.snappingService.snapToPoint(latlng,
                {
                    points: [
                        {
                            latlng: this.geoLocationService.currentLocation,
                            type: "star",
                            urls: [],
                            title: "",
                            description: "",
                        } as Common.MarkerData
                    ],
                    sensitivity: 30
                });
            if (snappingPointResponse.markerData != null) {
                return snappingPointResponse;
            }
        }
        return this.snappingService.snapToPoint(latlng);
    }

    public getSnappingForRoute(latlng: L.LatLng, isSnapToSelf: boolean = true): ISnappingForRouteResponse {

        let geoLocationPoint = [] as Common.MarkerData[];
        if (this.geoLocationService.getState() === "tracking") {
            geoLocationPoint.push({
                latlng: this.geoLocationService.currentLocation,
                type: "star",
                urls: [],
                title: "",
                description: "",
            } as Common.MarkerData);
        }
        // private POIs + Geo Location
        let snappingPointResponse = this.snappingService.snapToPoint(latlng,
            {
                points: geoLocationPoint.concat(this.route.markers),
                sensitivity: 30
            });
        if (snappingPointResponse.markerData != null) {
            return {
                latlng: snappingPointResponse.latlng,
                isSnapToSelfRoute: false
            };
        }

        // public POIs
        snappingPointResponse = this.snappingService.snapToPoint(latlng);
        if (snappingPointResponse.markerData != null) {
            return {
                latlng: snappingPointResponse.latlng,
                isSnapToSelfRoute: false
            };
        }

        let snappingRouteResponse = this.snapToSelf(latlng);
        if (snappingRouteResponse.polyline != null && isSnapToSelf) {
            return {
                latlng: snappingRouteResponse.latlng,
                isSnapToSelfRoute: true
            };
        }

        snappingRouteResponse = this.snappingService.snapToRoute(latlng);
        if (snappingRouteResponse.polyline != null) {
            return {
                latlng: snappingRouteResponse.latlng,
                isSnapToSelfRoute: false
            };
        }

        return {
            latlng: latlng,
            isSnapToSelfRoute: false
        };
    }

    public getData = (): Common.RouteData => {
        let segmentsData = [] as Common.RouteSegmentData[];
        for (let segment of this.route.segments) {
            segmentsData.push({
                routePoint: segment.routePoint,
                latlngs: [...segment.latlngs],
                routingType: segment.routingType
            } as Common.RouteSegmentData);
        }
        let markersData = [] as Common.MarkerData[];
        for (let marker of this.route.markers) {
            markersData.push({
                title: marker.title,
                description: marker.description,
                latlng: marker.latlng,
                type: marker.type,
                urls: marker.urls
            });
        }
        return {
            name: this.route.properties.name,
            description: this.route.properties.description,
            color: this.route.properties.pathOptions.color,
            opacity: this.route.properties.pathOptions.opacity,
            weight: this.route.properties.pathOptions.weight,
            markers: markersData,
            segments: segmentsData
        } as Common.RouteData;
    }

    public setData = (data: Common.RouteData) => {
        this.setDataInternal(data);
        this.currentState.initialize();
    }

    public updateDataFromState = () => {
        let data = this.getData();
        this.setDataInternal(data);
    }

    private setDataInternal = (data: Common.RouteData) => {
        this.currentState.clear();
        this.route.segments = [];
        this.route.markers = [];
        for (let segmentData of data.segments) {
            let segment = { ...segmentData } as IRouteSegment;
            segment.polyline = null;
            segment.routePointMarker = null;
            this.route.segments.push(segment);
        }
        for (let markerData of data.markers) {
            let marker = { ...markerData } as IMarkerWithData;
            marker.marker = null;
            this.route.markers.push(marker);
        }
    }

    public raiseDataChanged = () => {
        let data = this.getData();
        this.undoHandler.addDataToUndoStack(data);
        this.dataChanged.next();
    }

    public clear = () => {
        this.currentState.clear();
        this.route.segments = [];
        this.route.markers = [];
        this.raiseDataChanged();
        this.currentState.initialize();
    }

    public undo = () => {
        this.undoHandler.pop();
        this.setData(this.undoHandler.top());
        this.dataChanged.next();
    }

    public isUndoDisabled = (): boolean => {
        return this.undoHandler.isUndoDisabled();
    }

    public reverse = () => {
        let data = this.getData();

        for (let segmentIndex = 0; segmentIndex < data.segments.length - 1; segmentIndex++) {
            let currentSegment = data.segments[segmentIndex];
            let nextSegment = data.segments[segmentIndex + 1];
            currentSegment.latlngs = nextSegment.latlngs.reverse();
            currentSegment.routingType = nextSegment.routingType;
        }
        let lastSegment = data.segments[data.segments.length - 1];
        let lastPoint = lastSegment.latlngs[0]; // this is becuase we already reversed that segment's points
        lastSegment.latlngs = [lastPoint, lastPoint];
        data.segments.reverse();
        this.setData(data);
        this.raiseDataChanged();
    }

    public setRoutingType = (routingType: Common.RoutingType) => {
        this.route.properties.currentRoutingType = routingType;
        if (this.route.properties.isRoutingPerPoint) {
            return;
        }
        for (let segment of this.route.segments) {
            segment.routingType = this.route.properties.currentRoutingType;
        }
        this.reRoute();
        this.raiseDataChanged();
    }

    private reRoute = (): void => {
        if (this.route.segments.length === 0) {
            return;
        }
        this.currentState.reRoute();
    }

    public getBounds = (): L.LatLngBounds => {
        if (this.route.segments.length === 0 && this.route.markers.length === 0) {
            return null;
        }
        let featureGroup = L.featureGroup([]);
        for (let segment of this.route.segments) {
            featureGroup.addLayer(L.polyline(segment.latlngs));
        }
        for (let marker of this.route.markers) {
            featureGroup.addLayer(L.marker(marker.latlng));
        }
        let bounds = featureGroup.getBounds();
        featureGroup.clearLayers();
        return bounds;
    }

    public makeAllPointsEditable = () => {
        if (this.route.segments.length === 0) {
            return;
        }
        let stateName = this.getStateName();
        this.setHiddenState();
        let segments = [];
        for (let segment of this.route.segments) {
            if (segment.latlngs.length === 0) {
                continue;
            }
            let previousPoint = segment.latlngs[0];
            for (let latLng of segment.latlngs) {
                if (previousPoint.equals(latLng)) {
                    continue;
                }
                segments.push({
                    latlngs: [previousPoint, latLng],
                    routingType: segment.routingType,
                    routePoint: latLng
                } as Common.RouteSegmentData);
                previousPoint = latLng;
            }
        }
        this.route.segments = segments;
        this.raiseDataChanged();
        this.setState(stateName);
    }

    getLastSegment(): IRouteSegment {
        return this.route.segments[this.route.segments.length - 1];
    }

    getLastLatLng(): Common.ILatLngTime {
        let lastSegmentLatLngs = this.getLastSegment().latlngs;
        return lastSegmentLatLngs[lastSegmentLatLngs.length - 1];
    }

    public setHiddenState(): void {
        this.setStateImplementation(RouteStateHidden);
    }

    public setReadOnlyState(): void {
        this.setStateImplementation(RouteStateReadOnly);
    }

    public setEditRouteState(): void {
        this.setStateImplementation(RouteStateEditRoute);
    }

    public setEditPoiState(): void {
        this.setStateImplementation(RouteStateEditPoi);
    }

    private setStateImplementation<State extends RouteStateBase>(type: { new(layer: IRouteLayer): State; }): void {
        this.currentState.clear(); // initialize happens in new state constructor
        this.currentState = new type(this);
    }
}