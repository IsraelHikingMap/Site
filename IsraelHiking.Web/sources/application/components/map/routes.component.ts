import { Component, AfterViewInit, ViewEncapsulation } from "@angular/core";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { MapComponent } from "ngx-mapbox-gl";

import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "../intercations/route-edit-route.interaction";
import { SnappingService } from "../../services/snapping.service";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { LatLngAlt, ApplicationState, RouteData } from "../../models/models";

interface RoutePointViewData {
    latlng: LatLngAlt;
    segmentIndex: number;
}

@Component({
    selector: "routes",
    templateUrl: "./routes.component.html",
    styleUrls: ["./routes.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class RoutesComponent extends BaseMapComponent implements AfterViewInit {

    private static readonly START_COLOR = "#43a047";
    private static readonly END_COLOR = "red";

    @select((state: ApplicationState) => state.routes.present)
    public routes$: Observable<RouteData[]>;

    @select((state: ApplicationState) => state.routeEditingState.recordingRouteId)
    public routeRecordingId$: Observable<string>;

    public hoverFeature: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public routePointPopupData: RoutePointViewData;

    public editingRoute: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point>;
    public routesGeoJson: GeoJSON.FeatureCollection<GeoJSON.LineString | GeoJSON.Point>;

    private routes: RouteData[];

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly routeEditPoiInteraction: RouteEditPoiInteraction,
        private readonly routeEditRouteInteraction: RouteEditRouteInteraction,
        private readonly snappingService: SnappingService,
        private readonly host: MapComponent
    ) {
        super(resources);
        this.routesGeoJson = {
            type: "FeatureCollection",
            features: []
        };
        this.editingRoute = {
            type: "FeatureCollection",
            features: []
        };
        this.routes = [];
        this.setHoverFeature(null);
        this.routeEditRouteInteraction.onRoutePointClick.subscribe(this.handleRoutePointClick);
        this.routeEditRouteInteraction.onPointerMove.subscribe(this.setHoverFeature);
        this.routes$.subscribe(this.handleRoutesChanges);
        this.routeRecordingId$.subscribe(this.buildFeatureCollections);

    }

    private handleRoutesChanges = (routes: RouteData[]) => {
        this.routes = routes;
        this.snappingService.enable(this.isEditMode());
        if (!this.isEditMode()) {
            this.setHoverFeature(null);
        }
        this.setInteractionAccordingToState();
        this.buildFeatureCollections();
    }

    private buildFeatureCollections = () => {
        let features = [];
        let editingFeatures = [];
        for (let route of this.routes) {
            if (route.state === "Hidden") {
                continue;
            }
            if (route.state === "Route") {
                editingFeatures = this.createFeaturesForEditingRoute(route);
                continue;
            }
            features = features.concat(this.createFeaturesForRoute(route));
        }
        this.routesGeoJson = {
            type: "FeatureCollection",
            features: features
        };
        this.editingRoute = {
            type: "FeatureCollection",
            features: editingFeatures
        };
        this.routeEditRouteInteraction.setData(this.editingRoute);
    }

    private handleRoutePointClick = (pointIndex: number) => {
        if (pointIndex == null || (this.routePointPopupData != null && this.routePointPopupData.segmentIndex === pointIndex)) {
            this.routePointPopupData = null;
            return;
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        let segment = selectedRoute.segments[pointIndex];
        setTimeout(() => {
            // allow angular to draw this as it seems not to do it without this timeout...
            this.routePointPopupData = {
                latlng: segment.routePoint,
                segmentIndex: pointIndex,
            };
        }, 0);
    }

    public closeRoutePointPopup() {
        this.routePointPopupData = null;
    }

    private setHoverFeature = (latLng: LatLngAlt) => {
        if (!latLng) {
            this.hoverFeature = {
                type: "FeatureCollection",
                features: []
            };
            return;
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.hoverFeature = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: { color: selectedRoute.color, opacity: selectedRoute.opacity || 1.0 },
                geometry: {
                    type: "Point",
                    coordinates: [latLng.lng, latLng.lat]
                }
            }]
        };
    }

    private createFeaturesForEditingRoute(route: RouteData): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point>[] {
        let features = [];
        for (let segmentIndex = 0; segmentIndex < route.segments.length; segmentIndex++) {
            let segmentFeature = {
                type: "Feature",
                id: RouteEditRouteInteraction.createSegmentId(route, segmentIndex),
                properties: this.routeToProperties(route),
                geometry: {
                    type: "LineString",
                    coordinates: route.segments[segmentIndex].latlngs.map(l => SpatialService.toCoordinate(l))
                }
            };
            segmentFeature.properties.id = RouteEditRouteInteraction.createSegmentId(route, segmentIndex);
            features.push(segmentFeature);
            let segmentPointFeature = {
                type: "Feature",
                id: RouteEditRouteInteraction.createSegmentPointId(route, segmentIndex),
                properties: this.routeToProperties(route),
                geometry: {
                    type: "Point",
                    coordinates: SpatialService.toCoordinate(route.segments[segmentIndex].routePoint)
                }
            };
            segmentPointFeature.properties.id = RouteEditRouteInteraction.createSegmentPointId(route, segmentIndex);
            if (segmentIndex === 0) {
                segmentPointFeature.properties.color = RoutesComponent.START_COLOR;
            } else if (segmentIndex === route.segments.length - 1) {
                segmentPointFeature.properties.color = RoutesComponent.END_COLOR;
            }
            features.push(segmentPointFeature);
        }
        return features;
    }

    private createFeaturesForRoute(route: RouteData): GeoJSON.Feature<GeoJSON.LineString | GeoJSON.Point>[] {
        let features = [];
        let coordinatesArray = route.segments.map(s => s.latlngs.map(l => SpatialService.toCoordinate(l)));
        let routeCoordinates = [].concat.apply([], coordinatesArray); // flatten
        if (routeCoordinates.length < 2) {
            return features;
        }
        let properties = this.routeToProperties(route);
        features.push(
            {
                type: "Feature",
                id: route.id,
                properties: properties,
                geometry: {
                    type: "LineString",
                    coordinates: routeCoordinates
                }
            });
        properties = this.routeToProperties(route);
        properties.color = RoutesComponent.START_COLOR;
        properties.id = route.id + "_start";
        features.push(
            {
                type: "Feature",
                id: properties.id,
                properties: properties,
                geometry: {
                    type: "Point",
                    coordinates: routeCoordinates[0]
                }
            });
        if (this.isRouteRecording(route)) {
            return features;
        }
        properties = this.routeToProperties(route);
        properties.color = RoutesComponent.END_COLOR;
        properties.id = route.id + "_end";
        features.push(
            {
                type: "Feature",
                id: properties.id,
                properties: properties,
                geometry: {
                    type: "Point",
                    coordinates: routeCoordinates[routeCoordinates.length - 1]
                }
            });
        return features;
    }

    private routeToProperties(route: RouteData) {
        let color = route.color;
        let opacity = route.opacity || 1.0;
        let width = route.weight;
        if (this.isRouteRecording(route)) {
            color = "#FF6600";
            opacity = 1.0;
            width = 6;
        }
        return {
            color: color,
            weight: width,
            opacity: opacity,
            name: route.name,
            id: route.id
        };
    }

    private setInteractionAccordingToState() {
        if (this.host.mapInstance == null) {
            return;
        }
        this.routeEditPoiInteraction.setActive(false, this.host.mapInstance);
        this.routeEditRouteInteraction.setActive(false, this.host.mapInstance);
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.host.mapInstance.getCanvas().style.cursor = "";
        if (selectedRoute == null) {

            return;
        }
        if (selectedRoute.state === "Poi") {
            this.routeEditPoiInteraction.setActive(true, this.host.mapInstance);
            this.host.mapInstance.getCanvas().style.cursor = "pointer";
        } else if (selectedRoute.state === "Route") {
            this.routeEditRouteInteraction.setActive(true, this.host.mapInstance);
            this.host.mapInstance.getCanvas().style.cursor = "pointer";
        }
    }

    public markerDragEnd(index: number, event) {
        this.routeEditPoiInteraction.handleDragEnd(event.getLngLat(), index);
    }

    public ngAfterViewInit(): void {
        this.host.load.subscribe(() => {
            this.setInteractionAccordingToState();
        });
    }

    private isEditMode(): boolean {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route");
    }

    public isRouteRecording(route: RouteData) {
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        return recordingRoute != null && recordingRoute.id === route.id;
    }

    public isLast(segmentIndex: number, routeData: RouteData) {
        return segmentIndex === routeData.segments.length - 1;
    }

    public isRouteInEditPoiMode(route: RouteData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === route.id && selectedRoute.state === "Poi";
    }
}