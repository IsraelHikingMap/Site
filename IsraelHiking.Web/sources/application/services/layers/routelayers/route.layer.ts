import { ApplicationRef } from "@angular/core";
import { SnappingService } from "../../snapping.service";
import { MapService } from "../../map.service";
import { RouterService } from "../../routers/router.service";
import { ElevationProvider } from "../../elevation.provider";
import { IRouteState, EditMode } from "./iroute-state";
import { IRouteLayer, IRoute, IRouteProperties, IRouteSegment, IMarkerWithData, EditModeString } from "./iroute.layer";
import { RouteStateReadOnly } from "./route-state-read-only";
import { RouteStateHidden } from "./route-state-hidden";
import { RouteStateEditPoi } from "./route-state-edit-poi";
import { RouteStateEditRoute } from "./route-state-edit-route";
import { UndoHandler } from "./undo-handler";
import { ISnappingResponse, ISnappingOptions } from "../../snapping.service"
import { Subject } from "rxjs/Subject";
import { Injector, ComponentFactoryResolver } from "@angular/core";
import * as Common from "../../../common/IsraelHiking";

export class RouteLayer extends L.Layer implements IRouteLayer {
    public route: IRoute;
    public dataChanged: Subject<any>;
    public polylineHovered: Subject<L.LatLng>;

    private currentState: IRouteState;
    private undoHandler: UndoHandler<Common.RouteData>;
    public map: L.Map;

    constructor(public mapService: MapService,
        public snappingService: SnappingService,
        public routerService: RouterService,
        public elevationProvider: ElevationProvider,
        public injector: Injector,
        public componentFactoryResolver: ComponentFactoryResolver,
        public applicationRef: ApplicationRef,
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

    public clearCurrentState() {
        this.currentState.clear();
    }

    public setState(state: IRouteState) {
        this.currentState = state;
    }

    public getEditMode(): EditMode {
        return this.currentState.getEditMode();
    }

    public setRouteProperties(properties: IRouteProperties) {
        this.route.properties = properties;
        this.currentState.clear();
        this.currentState.initialize();
    }

    public snapToRoute(latlng: L.LatLng): ISnappingResponse {
        var polylines = [];
        for (let segment of this.route.segments) {
            polylines.push(segment.polyline);
        }
        return this.snappingService.snapTo(latlng, {
            sensitivity: 30,
            layers: L.layerGroup(polylines)
        } as ISnappingOptions);
    }

    public getData = (): Common.RouteData => {
        let segmentsData = [] as Common.RouteSegmentData[];
        for (let segment of this.route.segments) {
            segmentsData.push({
                routePoint: segment.routePoint,
                latlngs: [ ...segment.latlngs ],
                routingType: segment.routingType
            } as Common.RouteSegmentData);
        }
        let markersData = [] as Common.MarkerData[];
        for (let marker of this.route.markers) {
            markersData.push({
                title: marker.title,
                latlng: marker.latlng,
                type: marker.type
            });
        }
        return {
            name: this.route.properties.name,
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
        var data = this.getData();
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
    }

    public isUndoDisbaled = (): boolean => {
        return this.undoHandler.isUndoDisbaled() || this.currentState.getEditMode() === EditModeString.none;
    }

    public reverse = () => {
        let data = this.getData();

        for (let segmentIndex = 0; segmentIndex < data.segments.length - 1; segmentIndex++) {
            var currentSegment = data.segments[segmentIndex];
            var nextSegment = data.segments[segmentIndex + 1];
            currentSegment.latlngs = nextSegment.latlngs.reverse();
            currentSegment.routingType = nextSegment.routingType;
        }
        var lastSegment = data.segments[data.segments.length - 1];
        var lastPoint = lastSegment.latlngs[0]; // this is becuase we already reversed that segment's points
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
        if (this.route.segments.length === 0) {
            return null;
        }
        let featureGroup = L.featureGroup([]);
        for (let segment of this.route.segments) {
            featureGroup.addLayer(L.polyline(segment.latlngs));
        }
        let bounds = featureGroup.getBounds();
        featureGroup.clearLayers();
        return bounds;
    }

    getLastSegment(): IRouteSegment {
        return this.route.segments[this.route.segments.length - 1];
    }

    getLastLatLng(): L.LatLng {
        let lastSegmentLatLngs = this.getLastSegment().latlngs;
        return lastSegmentLatLngs[lastSegmentLatLngs.length - 1];
    }

    public setHiddenState(): void {
        this.clearCurrentState();
        this.setState(new RouteStateHidden(this));
    }

    public setReadOnlyState(): void {
        this.clearCurrentState();
        this.setState(new RouteStateReadOnly(this));
    }

    public setEditRouteState(): void {
        this.clearCurrentState();
        this.setState(new RouteStateEditRoute(this));
    }

    public setEditPoiState(): void {
        this.clearCurrentState();
        this.setState(new RouteStateEditPoi(this));
    }
}