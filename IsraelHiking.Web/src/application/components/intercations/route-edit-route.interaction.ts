import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { MapMouseEvent, Map, GeoJSONSource } from "maplibre-gl";
import { Store } from "@ngxs/store";
import type Point from "@mapbox/point-geometry";

import { SelectedRouteService } from "../../services/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RouterService } from "../../services/router.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { SnappingService } from "../../services/snapping.service";
import { GeoLocationService } from "../../services/geo-location.service";
import { ResourcesService } from "../../services/resources.service";
import { AddSegmentAction, RoutesReducer, UpdateSegmentsAction } from "../../reducers/routes.reducer";
import type {
    ApplicationState,
    RouteData,
    LatLngAlt,
    RouteSegmentData,
    LatLngAltTime,
    MarkerData
} from "../../models/models";

const SEGMENT = "_segment_";
const SEGMENT_POINT = "_segmentpoint_";
const DRAG_PIXEL_TOLERANCE = 3;

declare type EditMouseState = "none" | "down" | "dragging" | "canceled";

@Injectable()
export class RouteEditRouteInteraction {

    public onRoutePointClick: EventEmitter<number>;

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
                private readonly snappingService: SnappingService,
                private readonly ngZone: NgZone,
                private readonly store: Store) {
        this.geoJsonData = null;
        this.selectedRouteSegments = [];
        this.selectedRoutePoint = null;
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

    private addEndOfRouteProgress(start: LatLngAlt, end: LatLngAlt): string {
        let id = "end-of-route-progress-line";
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        let newPointProgress = {
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: [[start.lng, start.lat], [end.lng, end.lat]]
            },
            properties: {
                id,
                weight: selectedRoute.weight,
                color: selectedRoute.color,
                opacity: selectedRoute.opacity,
                iconColor: selectedRoute.color,
                iconSize: 0.5
            }
        } as GeoJSON.Feature<GeoJSON.LineString>;
        this.updateData(newPointProgress);
        return id;
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

    private removeFeatureFromData(id: string) {
        this.geoJsonData.features = this.geoJsonData.features.filter(f => f.id !== id);
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
            map.getCanvas().addEventListener("keydown", this.cancelInteraction);
        } else {
            map.off("mousedown", this.handleDown);
            map.off("touchstart", this.handleDown);
            map.off("mousemove", this.handleMove);
            map.off("touchmove", this.handleMove);
            map.off("drag", this.handleMove);
            map.off("mouseup", this.handleUp);
            map.off("touchend", this.handleUp);
            map.getCanvas().removeEventListener("keydown", this.cancelInteraction);
        }
    }

    private cancelInteraction = () => {
        this.selectedRoutePoint = null;
        this.selectedRouteSegments = [];
        this.state = "canceled";
    };

    private handleDown = (event: MapMouseEvent) => {
        this.mouseDownPoint = event.point;
        if (this.isTouchesBiggerThan(event.originalEvent, 1)) {
            this.cancelInteraction();
            return;
        }
        this.state = "down";
        let latLng = event.lngLat;
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
        }
        if (this.isUpdating()) {
            event.preventDefault();
        } else {
            this.map.off("mousemove", this.handleMove);
            this.map.on("drag", this.handleMove);
        }
    };

    private handleMove = (event: MapMouseEvent) => {
        if (this.mouseDownPoint != null && event.point &&
            Math.abs((this.mouseDownPoint.x - event.point.x) + (this.mouseDownPoint.y - event.point.y)) < DRAG_PIXEL_TOLERANCE) {
            return;
        }
        if (this.isTouchesBiggerThan(event.originalEvent, 1)) {
            return;
        }
        if (this.state === "down") {
            this.state = "dragging";
        }
        if (this.state === "dragging") {
            this.raiseRoutePointClick(null);
            if (this.selectedRoutePoint != null) {
                this.handleRoutePointDrag(event);
            } else if (this.selectedRouteSegments.length > 0) {
                this.handleRouteMiddleSegmentDrag(event);
            }
        }
    };

    private handleRoutePointDrag(event: MapMouseEvent) {
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
        let coordinate = SpatialService.toCoordinate(event.lngLat);
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
        if (this.isTouchesBiggerThan(event.originalEvent, 0)) {
            // more than zero touches - no need to do any thing.
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
        let latlng = event.lngLat;
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
    };

    private addPointToEndOfRoute = async (latlng: LatLngAlt) => {
        let newSegment = this.createRouteSegment(latlng, [latlng, latlng]);
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute.segments.length === 0) {
            await this.elevationProvider.updateHeights(newSegment.latlngs);
        } else {
            let endPointSegmentIndex = selectedRoute.segments.length - 1;
            let startLatLng = selectedRoute.segments[endPointSegmentIndex].routePoint;
            let id = this.addEndOfRouteProgress(startLatLng, newSegment.routePoint);
            await this.runRouting(startLatLng, newSegment);
            this.removeFeatureFromData(id);
        }
        this.store.dispatch(new AddSegmentAction(selectedRoute.id, newSegment));
    };

    private createRouteSegment = (latlng: LatLngAlt, latlngs: LatLngAlt[]): RouteSegmentData => {
        let routeSegment = {
            routePoint: latlng,
            latlngs: latlngs as LatLngAltTime[],
            routingType: this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType
        };
        return routeSegment;
    };

    private runRouting = async (startLatLng: LatLngAlt, segment: RouteSegmentData): Promise<void> => {
        segment.routePoint = this.getSnappingForRoute(segment.routePoint, []);
        let latLngs =  await this.routerService.getRoute(startLatLng, segment.routePoint, segment.routingType);
        await this.elevationProvider.updateHeights(latLngs);
        segment.latlngs = latLngs as LatLngAltTime[];
        let last = latLngs[latLngs.length - 1];
        segment.routePoint = this.getSnappingForRoute(segment.routePoint, [last]);
    };

    private async updateRoutePoint(latlng: LatLngAlt) {
        let index = this.getPointIndex();
        let routeData = this.selectedRouteService.getSelectedRoute();
        let routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        let segment = { ...routeData.segments[index] };
        if (index === 0) {
            let nextSegment = { ...routeData.segments[index + 1] };
            await this.runRouting(latlng, nextSegment);
            let snappedLatLng = this.getSnappingForRoute(latlng, [nextSegment.latlngs[0]]) as LatLngAltTime;
            await this.elevationProvider.updateHeights([snappedLatLng]);
            segment.latlngs = [snappedLatLng, snappedLatLng];
            segment.routePoint = snappedLatLng;
            segment.routingType = routingType;

            this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index, index + 1], [segment, nextSegment]));
        } else if (index === routeData.segments.length - 1) {
            segment.routePoint = latlng;
            segment.routingType = routingType;
            let previousSegment = { ...routeData.segments[index - 1] };
            await this.runRouting(previousSegment.routePoint, segment);
            this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index], [segment]));
        } else {
            let previousSegment = routeData.segments[index - 1];
            segment.routePoint = latlng;
            segment.routingType = routingType;
            await this.runRouting(previousSegment.routePoint, segment);
            let nextSegment = { ...routeData.segments[index + 1] };
            await this.runRouting(segment.routePoint, nextSegment);
            this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index, index + 1], [segment, nextSegment]));
        }
    }

    private async updateRouteSegment(latlng: LatLngAlt) {
        let index = this.getSegmentIndex(this.selectedRouteSegments[0]);
        let routeData = this.selectedRouteService.getSelectedRoute();
        let segment = { ...routeData.segments[index] };
        let middleSegment = this.createRouteSegment(latlng, []);
        await this.runRouting(segment.latlngs[0], middleSegment);
        await this.runRouting(middleSegment.routePoint, segment);

        this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index], [middleSegment, segment]));
    }

    private splitRouteSegment(latlng: LatLngAlt) {
        let index = this.getSegmentIndex(this.selectedRouteSegments[0]);
        let routeData = this.selectedRouteService.getSelectedRoute();
        let segment = { ...routeData.segments[index] };
        let newLatlngs = SpatialService.splitLine(latlng, segment.latlngs);
        segment.latlngs = newLatlngs.end as LatLngAltTime[];
        let middleSegment = this.createRouteSegment(latlng, newLatlngs.start);
        this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index], [middleSegment, segment]));
    }

    private getPointIndex() {
        let splitStr = this.selectedRoutePoint.properties.id.toString().split(SEGMENT_POINT);
        return +splitStr[1];
    }

    private getSegmentIndex(segment: GeoJSON.Feature<GeoJSON.LineString>) {
        let splitStr = segment.id.toString().split(SEGMENT);
        return +splitStr[1];
    }

    private getSnappingForRoute(latlng: LatLngAlt, additionalLatlngs: LatLngAlt[]): LatLngAlt {
        let gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        if (gpsState.tracking === "tracking") {
            let currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
            additionalLatlngs.push(currentLocation);
        }
        // private POIs + Geo Location + Additional Point:
        let points = additionalLatlngs.map(l => ({
            latlng: l,
            type: "star",
            urls: [],
            title: "",
            description: "",
        } as MarkerData)).concat(this.selectedRouteService.getSelectedRoute().markers);
        let snappingPointResponse = this.snappingService.snapToPoint(latlng, points);
        return snappingPointResponse.latlng;
    }

    private raiseRoutePointClick(index: number) {
        this.ngZone.run(() => {
            this.onRoutePointClick.emit(index);
        });
    }

    private isTouchesBiggerThan(event: Event, touches: number): boolean {
        return window.TouchEvent && event instanceof TouchEvent && event.touches.length > touches;
    }
}
