import { Injectable, EventEmitter, NgZone, inject } from "@angular/core";
import { MapMouseEvent, Map, GeoJSONSource, type Point } from "maplibre-gl";
import { Store } from "@ngxs/store";
import { v4 as uuidv4 } from "uuid";
import type { Immutable } from "immer";

import { SelectedRouteService } from "../../services/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RoutingProvider } from "../../services/routing.provider";
import { ElevationProvider } from "../../services/elevation.provider";
import { SnappingService } from "../../services/snapping.service";
import { GeoLocationService } from "../../services/geo-location.service";
import { ResourcesService } from "../../services/resources.service";
import { AddSegmentAction, UpdateSegmentsAction } from "../../reducers/routes.reducer";
import type {
    ApplicationState,
    RouteData,
    LatLngAlt,
    RouteSegmentData,
    LatLngAltTime,
    MarkerData
} from "../../models";

const SEGMENT = "_segment_";
const SEGMENT_POINT = "_segmentpoint_";
const DRAG_PIXEL_TOLERANCE = 3;

declare type EditMouseState = "none" | "down" | "dragging" | "canceled";

@Injectable()
export class RouteEditRouteInteraction {

    public onRoutePointClick = new EventEmitter<number>();

    private state: EditMouseState = "none";
    private mouseDownPoint: Point = null;

    private selectedRoutePoint: GeoJSON.Feature<GeoJSON.Point> = null;
    private selectedRouteSegments: GeoJSON.Feature<GeoJSON.LineString>[] = [];
    private geoJsonData: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point> = null;
    private map: Map;

    private readonly resources = inject(ResourcesService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly routingProvider = inject(RoutingProvider);
    private readonly elevationProvider = inject(ElevationProvider);
    private readonly snappingService = inject(SnappingService);
    private readonly ngZone = inject(NgZone);
    private readonly store = inject(Store);

    public static createSegmentId(route: Immutable<RouteData>, index: number) {
        return route.id + SEGMENT + index;
    }

    public static createSegmentPointId(route: Immutable<RouteData>, index: number) {
        return route.id + SEGMENT_POINT + index;
    }

    private addEndOfRouteProgress(start: LatLngAlt, end: LatLngAlt): string {
        const id = "end-of-route-progress-line";
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        const newPointProgress = {
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
        const features = this.geoJsonData.features.filter(f => f.id !== feature.id);
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
            map.on("click", this.handleClick);
            map.getCanvas().addEventListener("keydown", this.cancelInteraction);
        } else {
            map.off("mousedown", this.handleDown);
            map.off("touchstart", this.handleDown);
            map.off("mousemove", this.handleMove);
            map.off("touchmove", this.handleMove);
            map.off("mouseup", this.handleUp);
            map.off("touchend", this.handleUp);
            map.off("click", this.handleClick);
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
        const latLng = event.lngLat;
        const point = event.target.project(latLng);
        const th = 10;
        const routePoints = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
            {
                layers: [this.resources.editRoutePoints],
            });
        this.selectedRoutePoint = routePoints.length > 0 ? this.getFeatureById(routePoints[0].properties.id) : null;
        if (this.selectedRoutePoint != null) {
            const pointIndex = this.getPointIndex();
            const selectedRoute = this.selectedRouteService.getSelectedRoute();
            const segmentStart = this.getFeatureById<GeoJSON.LineString>(
                RouteEditRouteInteraction.createSegmentId(selectedRoute, pointIndex)
            );
            const segmentEnd = this.getFeatureById<GeoJSON.LineString>(
                RouteEditRouteInteraction.createSegmentId(selectedRoute, pointIndex + 1)
            );
            this.selectedRouteSegments = segmentEnd != null ? [segmentEnd, segmentStart] : [segmentStart];
        } else {
            const queryFeatures = event.target.queryRenderedFeatures([[point.x - th, point.y - th], [point.x + th, point.y + th]],
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
            // Avoid map panning when dragging
            event.preventDefault();
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
        if (this.state !== "dragging") {
            return;
        }
        this.raiseRoutePointClick(null);
        if (this.selectedRoutePoint != null) {
            this.handleRoutePointDrag(event);
        } else if (this.selectedRouteSegments.length > 0) {
            this.handleRouteMiddleSegmentDrag(event);
        }
    };

    private handleRoutePointDrag(event: MapMouseEvent) {
        const coordinate = SpatialService.toCoordinate(event.lngLat);
        this.selectedRoutePoint.geometry.coordinates = coordinate;
        this.updateData(this.selectedRoutePoint);
        const index = this.getPointIndex();
        if (this.selectedRouteSegments.length === 2) {
            const segmentEnd = this.selectedRouteSegments[0];
            const coordinates = segmentEnd.geometry.coordinates;
            segmentEnd.geometry.coordinates = [coordinate, coordinates[coordinates.length - 1]];
            this.updateData(segmentEnd);
            if (index !== 0) {
                const segmentStart = this.selectedRouteSegments[1];
                const start = segmentStart.geometry.coordinates[0];
                segmentStart.geometry.coordinates = [start, coordinate];
                this.updateData(segmentStart);
            }
        } else if (this.selectedRouteSegments.length === 1) {
            const segmentStart = this.selectedRouteSegments[0];
            const start = segmentStart.geometry.coordinates[0];
            segmentStart.geometry.coordinates = [start, coordinate];
            this.updateData(segmentStart);
        }
    }

    private handleRouteMiddleSegmentDrag(event: MapMouseEvent) {
        const coordinate = SpatialService.toCoordinate(event.lngLat);
        const segment = this.selectedRouteSegments[0];
        const coordinates = segment.geometry.coordinates;
        segment.geometry.coordinates = [coordinates[0], coordinate, coordinates[coordinates.length - 1]];
        this.updateData(segment);

    }

    private isUpdating() {
        return this.selectedRoutePoint != null || this.selectedRouteSegments.length > 0;
    }

    private handleUp = (event: MapMouseEvent) => {
        this.mouseDownPoint = null;
        if (this.isTouchesBiggerThan(event.originalEvent, 0)) {
            // more than zero touches - no need to do any thing.
            return;
        }
        if (this.state === "canceled") {
            this.state = "none";
            return;
        }
        const isUpdating = this.isUpdating();
        const isDragging = this.state === "dragging";
        this.state = "none";

        const latlng = event.lngLat;
        if (isDragging && isUpdating) {
            if (this.selectedRoutePoint != null) {
                // drag exiting route point
                this.updateRoutePoint(latlng);
            } else {
                // drag middle of segment
                this.updateRouteSegment(latlng);
            }
        }
    };

    private handleClick = (event: MapMouseEvent) => {
        const latlng = event.lngLat;
        if (!this.isUpdating()) {
            // new point
            this.addPointToEndOfRoute(latlng);
            return;
        }
        if (this.selectedRoutePoint != null) {
            // click on exiting point
            this.raiseRoutePointClick(this.getPointIndex());
        } else {
            // click on the middle of a segment
            this.splitRouteSegment(latlng);
        }
    };

    private addPointToEndOfRoute = async (latlng: LatLngAlt) => {
        const newSegment = this.createRouteSegment(latlng, [latlng, latlng]);
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute.segments.length === 0) {
            await this.elevationProvider.updateHeights(newSegment.latlngs);
        } else {
            const endPointSegmentIndex = selectedRoute.segments.length - 1;
            const startLatLng = selectedRoute.segments[endPointSegmentIndex].routePoint;
            const id = this.addEndOfRouteProgress(startLatLng, newSegment.routePoint);
            await this.runRouting(startLatLng, newSegment);
            this.removeFeatureFromData(id);
        }
        this.store.dispatch(new AddSegmentAction(selectedRoute.id, newSegment));
    };

    private createRouteSegment = (latlng: LatLngAlt, latlngs: LatLngAlt[]): RouteSegmentData => {
        const routeSegment = {
            routePoint: latlng,
            latlngs: latlngs as LatLngAltTime[],
            routingType: this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType
        };
        return routeSegment;
    };

    private runRouting = async (startLatLng: LatLngAlt, segment: RouteSegmentData): Promise<void> => {
        segment.routePoint = this.getSnappingForRoute(segment.routePoint, []);
        const latLngs =  await this.routingProvider.getRoute(startLatLng, segment.routePoint, segment.routingType);
        segment.latlngs = latLngs as LatLngAltTime[];
        const last = latLngs[latLngs.length - 1];
        segment.routePoint = this.getSnappingForRoute(segment.routePoint, [last]);
    };

    private async updateRoutePoint(latlng: LatLngAlt) {
        const index = this.getPointIndex();
        const routeData = this.selectedRouteService.getSelectedRoute();
        const routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        const segment = structuredClone(routeData.segments[index]) as RouteSegmentData;
        if (index === 0) {
            const nextSegment = structuredClone(routeData.segments[index + 1]) as RouteSegmentData;
            nextSegment.routingType = routingType;
            await this.runRouting(latlng, nextSegment);
            const snappedLatLng = this.getSnappingForRoute(latlng, [nextSegment.latlngs[0]]) as LatLngAltTime;
            await this.elevationProvider.updateHeights([snappedLatLng]);
            segment.latlngs = [snappedLatLng, snappedLatLng];
            segment.routePoint = snappedLatLng;
            segment.routingType = routingType;

            this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index, index + 1], [segment, nextSegment]));
        } else if (index === routeData.segments.length - 1) {
            segment.routePoint = latlng;
            segment.routingType = routingType;
            const previousSegment = { ...routeData.segments[index - 1] };
            await this.runRouting(previousSegment.routePoint, segment);
            this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index], [segment]));
        } else {
            const previousSegment = routeData.segments[index - 1];
            segment.routePoint = latlng;
            segment.routingType = routingType;
            await this.runRouting(previousSegment.routePoint, segment);
            const nextSegment = structuredClone(routeData.segments[index + 1]) as RouteSegmentData;
            nextSegment.routingType = routingType;
            await this.runRouting(segment.routePoint, nextSegment);
            this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index, index + 1], [segment, nextSegment]));
        }
    }

    private async updateRouteSegment(latlng: LatLngAlt) {
        const index = this.getSegmentIndex(this.selectedRouteSegments[0]);
        const routeData = this.selectedRouteService.getSelectedRoute();
        const segment = structuredClone(routeData.segments[index]) as RouteSegmentData;
        const middleSegment = this.createRouteSegment(latlng, []);
        await this.runRouting(segment.latlngs[0], middleSegment);
        await this.runRouting(middleSegment.routePoint, segment);

        this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index], [middleSegment, segment]));
    }

    private splitRouteSegment(latlng: LatLngAlt) {
        const index = this.getSegmentIndex(this.selectedRouteSegments[0]);
        const routeData = this.selectedRouteService.getSelectedRoute();
        const segment = structuredClone(routeData.segments[index]) as RouteSegmentData;
        const newLatlngs = SpatialService.splitLine(latlng, segment.latlngs);
        segment.latlngs = newLatlngs.end;
        const middleSegment = this.createRouteSegment(latlng, newLatlngs.start);
        this.store.dispatch(new UpdateSegmentsAction(routeData.id, [index], [middleSegment, segment]));
    }

    private getPointIndex() {
        const splitStr = this.selectedRoutePoint.properties.id.toString().split(SEGMENT_POINT);
        return +splitStr[1];
    }

    private getSegmentIndex(segment: GeoJSON.Feature<GeoJSON.LineString>) {
        const splitStr = segment.id.toString().split(SEGMENT);
        return +splitStr[1];
    }

    private getSnappingForRoute(latlng: LatLngAlt, additionalLatlngs: LatLngAlt[]): LatLngAlt {
        const gpsState = this.store.selectSnapshot((s: ApplicationState) => s.gpsState);
        if (gpsState.tracking === "tracking") {
            const currentLocation = GeoLocationService.positionToLatLngTime(gpsState.currentPosition);
            additionalLatlngs.push(currentLocation);
        }
        // private POIs + Geo Location + Additional Point:
        const points = additionalLatlngs.map(l => ({
            id: uuidv4(),
            latlng: l,
            type: "star",
            urls: [],
            title: "",
            description: "",
        } as Immutable<MarkerData>)).concat(this.selectedRouteService.getSelectedRoute().markers);
        const snappingPointResponse = this.snappingService.snapToPoint(latlng, points);
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
