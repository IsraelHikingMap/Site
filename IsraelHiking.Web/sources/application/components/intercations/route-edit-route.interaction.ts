import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { NgRedux } from "@angular-redux/store";
import { MapMouseEvent, Map, GeoJSONSource, Point } from "mapbox-gl";

import { AddSegmentAction, UpdateSegmentsAction } from "../../reducres/routes.reducer";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RouterService } from "../../services/routers/router.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { SnappingService } from "../../services/snapping.service";
import { GeoLocationService } from "../../services/geo-location.service";
import { ResourcesService } from "../../services/resources.service";
import {
    ApplicationState,
    RouteData,
    LatLngAlt,
    RouteSegmentData,
    ILatLngTime,
    MarkerData,
    RoutingType
} from "../../models/models";

const SEGMENT = "_segment_";
const SEGMENT_POINT = "_segmentpoint_";
const DRAG_PIXEL_TOLERANCE = 3;

declare type EditMouseState = "none" | "down" | "dragging" | "canceled";

@Injectable()
export class RouteEditRouteInteraction {

    public onRoutePointClick: EventEmitter<number>;
    public onPointerMove: EventEmitter<LatLngAlt>;

    private state: EditMouseState;
    private mouseDownPoint: Point;

    private selectedRoutePoint: GeoJSON.Feature<GeoJSON.Point>;
    private selectedRouteSegments: GeoJSON.Feature<GeoJSON.LineString>[];
    private geoJsonData: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point>;
    private map: Map;

    constructor(private readonly resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routerService: RouterService,
        private readonly elevationProvider: ElevationProvider,
        private readonly geoLocationService: GeoLocationService,
        private readonly snappingService: SnappingService,
        private readonly ngZone: NgZone,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        this.geoJsonData = null;
        this.selectedRouteSegments = [];
        this.selectedRoutePoint = null;
        this.onPointerMove = new EventEmitter();
        this.onRoutePointClick = new EventEmitter();
        this.state = "none";
        this.mouseDownPoint = null;
    }

    public static createSegmentId(route: RouteData, index: number) {
        return route.id + SEGMENT + index;
    }

    public static createSegmentPointId(route: RouteData, index: number) {
        return route.id + SEGMENT_POINT + index;
    }

    public setData(geojsonData: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point>) {
        this.geoJsonData = geojsonData;
    }

    private updateData(feature: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point>) {
        let features = this.geoJsonData.features.filter(f => f.id !== feature.id);
        features.push(feature);
        this.geoJsonData.features = features;
        (this.map.getSource("editing-route-source") as GeoJSONSource).setData(this.geoJsonData);
    }

    private getFeatureById<TGeometry extends GeoJSON.Geometry>(id: string): GeoJSON.Feature<TGeometry> {
        return this.geoJsonData.features.find(f => f.id === id) as any as GeoJSON.Feature<TGeometry>;
    }

    public setActive(active: boolean, map: Map) {
        this.map = map;
        if (active) {
            map.on("mousedown", this.handleDown);
            map.on("touchstart", this.handleDown);
            map.on("mousemove", this.handleMove);
            map.on("touchmove", this.handleMove);
            map.on("mouseup", this.handleUp);
            map.on("touchend", this.handleUp);
        } else {
            map.off("mousedown", this.handleDown);
            map.off("touchstart", this.handleDown);
            map.off("mousemove", this.handleMove);
            map.off("touchmove", this.handleMove);
            map.off("drag", this.handleMove);
            map.off("mouseup", this.handleUp);
            map.off("touchend", this.handleUp);
        }
    }

    private handleDown = (event: MapMouseEvent) => {
        this.mouseDownPoint = event.point;
        if (this.isMultiTouchEvent(event.originalEvent)) {
            this.selectedRoutePoint = null;
            this.selectedRouteSegments = [];
            this.state = "canceled";
            return;
        }
        this.state = "down";
        let latLng = this.getSnappingForRoute(event.lngLat);
        let point = event.target.project(latLng);
        let th = 10;
        let routePoints = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
            {
                layers: [this.resources.editRoutePoints],
            });
        this.selectedRoutePoint = routePoints.length > 0 ? this.getFeatureById(routePoints[0].properties.id) : null;
        if (this.selectedRoutePoint != null) {
            let pointIndex = this.getPointIndex();
            let selectedRoute = this.selectedRouteService.getSelectedRoute();
            let segmentStart = this.getFeatureById<GeoJSON.LineString>(
                RouteEditRouteInteraction.createSegmentId(selectedRoute, pointIndex)
            );
            let segmentEnd = this.getFeatureById<GeoJSON.LineString>(
                RouteEditRouteInteraction.createSegmentId(selectedRoute, pointIndex + 1)
            );
            this.selectedRouteSegments = segmentEnd != null ? [segmentEnd, segmentStart] : [segmentStart];
        } else {
            let queryFeatures = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
                {
                    layers: [this.resources.editRouteLines]
                });
            if (queryFeatures.length > 0) {
                this.selectedRouteSegments = [this.getFeatureById(queryFeatures[0].properties.id)];
            } else {
                this.selectedRouteSegments = [];
            }
        }
        if (this.selectedRoutePoint == null) {
            this.raiseRoutePointClick(null);
        } else {
            this.raisePointerMove(null);
        }
        if (this.isUpdating()) {
            event.preventDefault();
        } else {
            this.map.off("mousemove", this.handleMove);
            this.map.on("drag", this.handleMove);
        }
    }

    private handleMove = (event: MapMouseEvent) => {
        if (this.mouseDownPoint != null &&
            Math.abs((this.mouseDownPoint.x - event.point.x) + (this.mouseDownPoint.y - event.point.y)) < DRAG_PIXEL_TOLERANCE) {
            return;
        }
        if (this.isMultiTouchEvent(event.originalEvent)) {
            return;
        }
        if (this.state === "down") {
            this.state = "dragging";
        }
        if (this.state === "dragging") {
            this.raiseRoutePointClick(null);
            this.raisePointerMove(null);
            if (this.selectedRoutePoint != null) {
                this.handleRoutePointDrag(event);
            } else if (this.selectedRouteSegments.length > 0) {
                this.handleRouteMiddleSegmentDrag(event);
            }
        } else {
            let latLng = this.getSnappingForRoute(event.lngLat);
            this.raisePointerMove(latLng);
        }
    }

    private handleRoutePointDrag(event: MapMouseEvent) {
        // HM TODO: bring back snappings and make this faster...
        // let snappingLatLng = this.getSnappingForRoute(event.lngLat);
        // let coordinate = SpatialService.toCoordinate(snappingLatLng);
        let coordinate = SpatialService.toCoordinate(event.lngLat);
        this.selectedRoutePoint.geometry.coordinates = coordinate;
        this.updateData(this.selectedRoutePoint);
        let index = this.getPointIndex();
        if (this.selectedRouteSegments.length === 2) {
            let segmentEnd = this.selectedRouteSegments[0];
            let coordinates = segmentEnd.geometry.coordinates;
            segmentEnd.geometry.coordinates = [coordinate, coordinates[coordinates.length - 1]];
            this.updateData(segmentEnd);
            if (index !== 0) {
                let segmentStart = this.selectedRouteSegments[1];
                let start = segmentStart.geometry.coordinates[0];
                segmentStart.geometry.coordinates = [start, coordinate];
                this.updateData(segmentStart);
            }
        } else if (this.selectedRouteSegments.length === 1) {
            let segmentStart = this.selectedRouteSegments[0];
            let start = segmentStart.geometry.coordinates[0];
            segmentStart.geometry.coordinates = [start, coordinate];
            this.updateData(segmentStart);
        }
    }

    private handleRouteMiddleSegmentDrag(event: MapMouseEvent) {
        let snapping = this.getSnappingForRoute(event.lngLat);
        let coordinate = SpatialService.toCoordinate(snapping);
        let segment = this.selectedRouteSegments[0];
        let coordinates = segment.geometry.coordinates;
        segment.geometry.coordinates = [coordinates[0], coordinate, coordinates[coordinates.length - 1]];
        this.updateData(segment);

    }

    private isUpdating() {
        return this.selectedRoutePoint != null || this.selectedRouteSegments.length > 0;
    }

    private handleUp = (event: MapMouseEvent) => {
        this.mouseDownPoint = null;
        // this is used here to support touch screen and prevent additional mouse events
        event.originalEvent.preventDefault();
        if (event.originalEvent instanceof TouchEvent && event.originalEvent.touches.length > 0) {
            // more than one touch - no need to do any thing.
            return;
        }
        if (this.state === "canceled") {
            this.state = "none";
            return;
        }
        let isUpdating = this.isUpdating();
        if (!isUpdating) {
            this.map.on("mousemove", this.handleMove);
            this.map.off("drag", this.handleMove);
        }
        let isDragging = this.state === "dragging";
        this.state = "none";

        if (!isUpdating && isDragging) {
            // regular map pan
            return;
        }
        let latlng = this.getSnappingForRoute(event.lngLat);
        if (!isUpdating && !isDragging) {
            // new point
            this.addPointToEndOfRoute(latlng);
            return;
        }
        if (!isDragging) {
            if (this.selectedRoutePoint != null) {
                // click on exiting point
                this.raiseRoutePointClick(this.getPointIndex());
            } else {
                // click on the middle of a segment
                this.splitRouteSegment(latlng);
            }
            return;
        }
        // drag exiting route point
        if (this.selectedRoutePoint != null) {
            this.updateRoutePoint(latlng);
        } else {
            this.updateRouteSegment(latlng);
        }

        return;
    }

    private addPointToEndOfRoute = async (latlng: LatLngAlt) => {
        let newSegment = this.createRouteSegment(latlng, [latlng, latlng]);
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute.segments.length === 0) {
            newSegment.latlngs = await this.elevationProvider.updateHeights(newSegment.latlngs) as ILatLngTime[];
        } else {
            let endPointSegmentIndex = selectedRoute.segments.length - 1;
            let startLatLng = selectedRoute.segments[endPointSegmentIndex].routePoint;
            let routingType = this.ngRedux.getState().routeEditingState.routingType;
            newSegment.latlngs = await this.runRouting(startLatLng, latlng, routingType);
        }
        this.ngRedux.dispatch(new AddSegmentAction({
            routeId: selectedRoute.id,
            segmentData: newSegment
        }));
    }

    private createRouteSegment = (latlng: LatLngAlt, latlngs: LatLngAlt[]): RouteSegmentData => {
        let routeSegment = {
            routePoint: latlng,
            latlngs: latlngs as ILatLngTime[],
            routingType: this.ngRedux.getState().routeEditingState.routingType
        };
        return routeSegment;
    }

    private runRouting = async (startLatLng: LatLngAlt, endLatLng: LatLngAlt, routingType: RoutingType): Promise<any> => {
        let data = await this.routerService.getRoute(startLatLng, endLatLng, routingType);
        let latLngs = data[data.length - 1].latlngs;
        latLngs = await this.elevationProvider.updateHeights(latLngs) as ILatLngTime[];
        return latLngs;
    }

    private async updateRoutePoint(latlng: LatLngAlt) {
        let index = this.getPointIndex();
        let routeData = this.selectedRouteService.getSelectedRoute();
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        let segment = { ...routeData.segments[index] };
        if (index === 0) {
            segment.latlngs = await this.elevationProvider.updateHeights([latlng, latlng]) as ILatLngTime[];
            segment.routePoint = latlng;
            segment.routingType = routingType;
            let nextSegment = routeData.segments[index + 1];
            nextSegment.latlngs = await this.runRouting(segment.routePoint, nextSegment.routePoint, routingType);
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: routeData.id,
                indices: [index, index + 1],
                segmentsData: [segment, nextSegment]
            }));
        } else if (index === routeData.segments.length - 1) {
            segment.routePoint = latlng;
            segment.routingType = routingType;
            let previousSegment = { ...routeData.segments[index - 1] };
            segment.latlngs = await this.runRouting(previousSegment.routePoint, segment.routePoint, routingType);
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: routeData.id,
                indices: [index],
                segmentsData: [segment]
            }));
        } else {
            let previousSegment = routeData.segments[index - 1];
            segment.routePoint = latlng;
            segment.routingType = routingType;
            segment.latlngs = await this.runRouting(previousSegment.routePoint, segment.routePoint, routingType);
            let nextSegment = routeData.segments[index + 1];
            nextSegment.latlngs = await this.runRouting(segment.routePoint, nextSegment.routePoint, nextSegment.routingType);
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: routeData.id,
                indices: [index, index + 1],
                segmentsData: [segment, nextSegment]
            }));
        }
    }

    private async updateRouteSegment(latlng: LatLngAlt) {
        let index = this.getSegmentIndex(this.selectedRouteSegments[0]);
        let routeData = this.selectedRouteService.getSelectedRoute();
        let segment = { ...routeData.segments[index] };
        let latlngStart = await this.runRouting(segment.latlngs[0], latlng, this.ngRedux.getState().routeEditingState.routingType);
        let latlngEnd = await this.runRouting(latlng, segment.routePoint, segment.routingType);
        segment.latlngs = latlngEnd;
        let middleSegment = this.createRouteSegment(latlng, latlngStart);
        this.ngRedux.dispatch(new UpdateSegmentsAction({
            routeId: routeData.id,
            indices: [index],
            segmentsData: [middleSegment, segment]
        }));
    }

    private splitRouteSegment(latlng: LatLngAlt) {
        let index = this.getSegmentIndex(this.selectedRouteSegments[0]);
        let routeData = this.selectedRouteService.getSelectedRoute();
        let segment = { ...routeData.segments[index] };
        let closestPointOnSegment = segment.latlngs[0];
        for (let currentLatLng of segment.latlngs) {
            if (SpatialService.getDistance(currentLatLng, latlng) <
                SpatialService.getDistance(closestPointOnSegment, latlng)) {
                closestPointOnSegment = currentLatLng;
            }
        }
        let indexOnSegment = segment.latlngs.indexOf(closestPointOnSegment);
        let latlngStart = segment.latlngs.slice(0, indexOnSegment < segment.latlngs.length ? indexOnSegment + 1 : indexOnSegment);
        let latlngEnd = segment.latlngs.slice(indexOnSegment);
        segment.latlngs = latlngEnd;
        let middleSegment = this.createRouteSegment(latlng, latlngStart);
        this.ngRedux.dispatch(new UpdateSegmentsAction({
            routeId: routeData.id,
            indices: [index],
            segmentsData: [middleSegment, segment]
        }));
    }

    private getPointIndex() {
        let splitStr = this.selectedRoutePoint.properties.id.toString().split(SEGMENT_POINT);
        return +splitStr[1];
    }

    private getSegmentIndex(segment: GeoJSON.Feature<GeoJSON.LineString>) {
        let splitStr = segment.id.toString().split(SEGMENT);
        return +splitStr[1];
    }

    private getSnappingForRoute(latlng: LatLngAlt): LatLngAlt {
        let geoLocationPoint = [] as MarkerData[];
        if (this.geoLocationService.getState() === "tracking") {
            geoLocationPoint.push({
                latlng: this.geoLocationService.currentLocation,
                type: "star",
                urls: [],
                title: "",
                description: "",
            } as MarkerData);
        }
        // private POIs + Geo Location
        let snappingPointResponse = this.snappingService.snapToPoint(latlng,
            {
                points: geoLocationPoint.concat(this.selectedRouteService.getSelectedRoute().markers),
                sensitivity: 30
            });
        if (snappingPointResponse.markerData != null) {
            return snappingPointResponse.latlng;
        }

        // public POIs
        snappingPointResponse = this.snappingService.snapToPoint(latlng);
        if (snappingPointResponse.markerData != null) {
            return snappingPointResponse.latlng;
        }

        let snappingRouteResponse = this.snappingService.snapToRoute(latlng);
        if (snappingRouteResponse.line != null) {
            return snappingRouteResponse.latlng;
        }
        return latlng;
    }

    private raisePointerMove(latLng: LatLngAlt) {
        // this.ngZone.run(() => {
        //    this.onPointerMove.emit(latLng);
        // });
    }

    private raiseRoutePointClick(index: number) {
        this.ngZone.run(() => {
            this.onRoutePointClick.emit(index);
        });
    }

    private isMultiTouchEvent(event: Event): boolean {
        return event instanceof TouchEvent && event.touches.length > 1;
    }
}