import { Injectable, EventEmitter } from "@angular/core";

import { MapBrowserEvent, interaction, Feature, geom } from "openlayers";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { AddSegmentAction, UpdateSegmentsAction } from "../../reducres/routes.reducer";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RouterService } from "../../services/routers/router.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { SnappingService } from "../../services/snapping.service";
import { GeoLocationService } from "../../services/geo-location.service";
import {
    ApplicationState,
    RouteData,
    LatLngAlt,
    RoutingType,
    RouteSegmentData,
    ILatLngTime,
    MarkerData
} from "../../models/models";

const SEGMENT = "_segment_";
const SEGMENT_POINT = "_segmentpoint_";

@Injectable()
export class RouteEditRouteInteraction extends interaction.Interaction {

    public onRoutePointClick: EventEmitter<number>;
    public onPointerMove: EventEmitter<LatLngAlt>;

    private dragging: boolean;
    private selectedRoutePoint: Feature;
    private selectedRouteSegments: Feature[];

    @select((state: ApplicationState) => state.routeEditingState.routingType)
    private routingType$: Observable<RoutingType>;

    private routingType: RoutingType;

    constructor(private readonly selectedRouteService: SelectedRouteService,
        private readonly routerService: RouterService,
        private readonly elevationProvider: ElevationProvider,
        private readonly geoLocationService: GeoLocationService,
        private readonly snappingService: SnappingService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super({
            handleEvent: (e) => {
                switch (e.type) {
                    case "pointerdown":
                        return this.handleDown(e);
                    case "pointerdrag":
                        return this.handleDrag(e);
                    case "pointerup":
                        return this.handleUp(e);
                    case "pointermove":
                        return this.handleMove(e);
                    default:
                        return true;
                }
            }
        });
        this.dragging = false;
        this.selectedRouteSegments = [];
        this.selectedRoutePoint = null;
        this.onPointerMove = new EventEmitter();
        this.routingType$.subscribe(r => this.routingType = r);
        this.onRoutePointClick = new EventEmitter();
    }

    public static createSegmentId(route: RouteData, index: number) {
        return route.id + SEGMENT + index;
    }

    public static createSegmentPointId(route: RouteData, index: number) {
        return route.id + SEGMENT_POINT + index;
    }

    private handleDown(event: MapBrowserEvent) {
        this.dragging = false;
        let latLng = this.getSnappingForRoute(SpatialService.fromViewCoordinate(event.coordinate));
        let pixel = event.map.getPixelFromCoordinate(SpatialService.toViewCoordinate(latLng));
        let features = (event.map.getFeaturesAtPixel(pixel, { hitTolerance: 10 }) || []) as Feature[];
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.selectedRoutePoint = features.find(f =>
            f.getId() &&
            f.getId().toString().indexOf(selectedRoute.id + SEGMENT_POINT) !== -1 &&
            f.getGeometry() instanceof geom.Point);
        if (this.selectedRoutePoint != null) {
            let pointIndex = this.getPointIndex();
            let segments = (event.map.getFeaturesAtPixel(pixel, { hitTolerance: 100 }) || []) as Feature[];
            this.selectedRouteSegments = segments.filter(f =>
                f.getId() &&
                f.getId().toString().indexOf(selectedRoute.id + SEGMENT) !== -1 &&
                f.getGeometry() instanceof geom.LineString &&
                (this.getSegmentIndex(f) === pointIndex || this.getSegmentIndex(f) === pointIndex + 1));
        } else {
            this.selectedRouteSegments = [];
        }

        if (this.selectedRoutePoint == null) {
            this.onRoutePointClick.emit(null);
        } else {
            this.onPointerMove.emit(null);
        }
        return this.selectedRoutePoint == null && this.selectedRouteSegments.length === 0;
    }

    private handleDrag(event) {
        this.dragging = true;
        this.onRoutePointClick.emit(null);
        this.onPointerMove.emit(null);
        if (this.selectedRoutePoint != null) {
            return this.handleRoutePointDrag(event);
        }
        if (this.selectedRouteSegments.length > 0) {
            return this.handleRouteMiddleSegmentDrag(event);
        }
        return true;
    }

    private handleRoutePointDrag(event): boolean {
        let snappingLatLng = this.getSnappingForRoute(SpatialService.fromViewCoordinate(event.coordinate));
        let coordinate = SpatialService.toViewCoordinate(snappingLatLng);
        let point = (this.selectedRoutePoint.getGeometry() as geom.Point);
        point.setCoordinates(coordinate);
        this.selectedRoutePoint.setGeometry(point);
        let index = this.getPointIndex();
        if (this.selectedRouteSegments.length === 2) {
            let segmentEnd = this.selectedRouteSegments[0];
            let coordinates = (segmentEnd.getGeometry() as geom.LineString).getCoordinates();
            segmentEnd.setGeometry(new geom.LineString([coordinate, coordinates[coordinates.length - 1]]));
            if (index !== 0) {
                let segmentStart = this.selectedRouteSegments[1];
                let start = (segmentStart.getGeometry() as geom.LineString).getCoordinates()[0];
                segmentStart.setGeometry(new geom.LineString([start, coordinate]));
            }
        } else if (this.selectedRouteSegments.length === 1) {
            let segmentStart = this.selectedRouteSegments[0];
            let start = (segmentStart.getGeometry() as geom.LineString).getCoordinates()[0];
            segmentStart.setGeometry(new geom.LineString([start, coordinate]));
        }
        return false;
    }

    private handleRouteMiddleSegmentDrag(event): boolean {
        let snapping = this.getSnappingForRoute(SpatialService.fromViewCoordinate(event.coordinate));
        let coordinate = SpatialService.toViewCoordinate(snapping);
        let segment = this.selectedRouteSegments[0];
        let coordinates = (segment.getGeometry() as geom.LineString).getCoordinates();
        segment.setGeometry(new geom.LineString([coordinates[0], coordinate, coordinates[coordinates.length - 1]]));
        return false;
    }

    private handleUp(event: MapBrowserEvent) {
        let updating = this.selectedRoutePoint != null || this.selectedRouteSegments.length !== 0;
        if (!updating && this.dragging) {
            // regular map pan
            return true;
        }
        let latlng = SpatialService.fromViewCoordinate(event.coordinate);
        latlng = this.getSnappingForRoute(latlng);
        if (!updating && !this.dragging) {
            // new point
            this.addPointToRoute(latlng);
            return true;
        }
        if (!this.dragging) {
            this.onRoutePointClick.emit(this.getPointIndex());
            return true;
        }
        // drag exiting route point
        if (this.selectedRoutePoint != null) {
            this.updateRoutePoint(latlng);
        } else {
            this.updateRouteSegment(latlng);
        }

        return true;
    }

    private handleMove(event: MapBrowserEvent) {
        if (event.dragging) {
            return false;
        }
        let latLng = this.getSnappingForRoute(SpatialService.fromViewCoordinate(event.coordinate));
        this.onPointerMove.emit(latLng);
        return true;
    }

    private addPointToRoute = async (latlng: LatLngAlt) => {
        let newSegment = this.createRouteSegment(latlng, [latlng, latlng]);
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute.segments.length === 0) {
            newSegment.latlngs = await this.elevationProvider.updateHeights(newSegment.latlngs) as ILatLngTime[];
        } else {
            let endPointSegmentIndex = selectedRoute.segments.length - 1;
            let startLatLng = selectedRoute.segments[endPointSegmentIndex].routePoint;
            newSegment.latlngs = await this.runRouting(startLatLng, latlng);
        }
        this.ngRedux.dispatch(new AddSegmentAction({
            routeId: selectedRoute.id,
            segmentData: newSegment
        }));
    }

    protected createRouteSegment = (latlng: LatLngAlt, latlngs: LatLngAlt[]): RouteSegmentData => {
        let routeSegment = {
            routePoint: latlng,
            latlngs: latlngs as ILatLngTime[],
            routingType: this.routingType
        };
        return routeSegment;
    }

    private runRouting = async (startLatLng: LatLngAlt, endLatLng: LatLngAlt): Promise<any> => {
        let data = await this.routerService.getRoute(startLatLng, endLatLng, this.routingType);
        let latLngs = data[data.length - 1].latlngs;
        latLngs = await this.elevationProvider.updateHeights(latLngs) as ILatLngTime[];
        return latLngs;
    }

    private async updateRoutePoint(latlng: LatLngAlt) {
        let index = this.getPointIndex();
        let routeData = this.selectedRouteService.getSelectedRoute();
        let segment = { ...routeData.segments[index] };
        if (index === 0) {
            segment.latlngs = [latlng, latlng] as ILatLngTime[];
            segment.routePoint = latlng;
            segment.routingType = this.routingType;
            let nextSegment = routeData.segments[index + 1];
            nextSegment.latlngs = await this.runRouting(segment.routePoint, nextSegment.routePoint);
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: routeData.id,
                indices: [index, index + 1],
                segmentsData: [segment, nextSegment]
            }));
        } else if (index === routeData.segments.length - 1) {
            segment.routePoint = latlng;
            segment.routingType = this.routingType;
            let previousSegment = { ...routeData.segments[index - 1] };
            segment.latlngs = await this.runRouting(previousSegment.routePoint, segment.routePoint);
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: routeData.id,
                indices: [index],
                segmentsData: [segment]
            }));
        } else {
            let previousSegment = routeData.segments[index - 1];
            segment.routePoint = latlng;
            segment.routingType = this.routingType;
            segment.latlngs = await this.runRouting(previousSegment.routePoint, segment.routePoint);
            let nextSegment = routeData.segments[index + 1];
            nextSegment.latlngs = await this.runRouting(segment.routePoint, nextSegment.routePoint);
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: routeData.id,
                indices: [index, index + 1],
                segmentsData: [segment, nextSegment]
            }));
        }
    }

    private async updateRouteSegment(latlng: LatLngAlt) {
        let splitStr = (this.selectedRouteSegments[0].getId() as string).split(SEGMENT);
        let index = +splitStr[1];
        let routeData = this.selectedRouteService.getSelectedRoute();
        let segment = { ... routeData.segments[index] };
        let latlngStart = await this.runRouting(segment.latlngs[0], latlng);
        let latlngEnd = await this.runRouting(latlng, segment.routePoint);
        segment.routingType = this.routingType;
        segment.latlngs = latlngEnd;
        let middleSegment = this.createRouteSegment(latlng, latlngStart);
        this.ngRedux.dispatch(new UpdateSegmentsAction({
            routeId: routeData.id,
            indices: [index],
            segmentsData: [middleSegment, segment]
        }));
    }

    private getPointIndex() {
        let splitStr = this.selectedRoutePoint.getId().toString().split(SEGMENT_POINT);
        return +splitStr[1];
    }

    private getSegmentIndex(segment: Feature) {
        let splitStr = segment.getId().toString().split(SEGMENT);
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
}