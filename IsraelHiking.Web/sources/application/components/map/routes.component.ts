import { Component, AfterViewInit, ViewChildren, QueryList } from "@angular/core";
import { MapComponent, FeatureComponent } from "ngx-openlayers";
import { Coordinate, style } from "openlayers";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";
import parse from "color-parse";

import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "../intercations/route-edit-route.interaction";
import { SnappingService } from "../../services/snapping.service";
import { LatLngAlt, ApplicationState, RouteData, RouteSegmentData } from "../../models/models";
import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";

interface RoutePointViewData {
    latlng: LatLngAlt;
    segmentIndex: number;
}

@Component({
    selector: "routes",
    templateUrl: "./routes.component.html"
})
export class RoutesComponent extends BaseMapComponent implements AfterViewInit {
    @select((state: ApplicationState) => state.routes.present)
    public routes$: Observable<RouteData[]>;

    @ViewChildren("markers")
    public routeMarkers: QueryList<FeatureComponent>;

    public hoverViewCoordinates: Coordinate;
    public routePointPopupData: RoutePointViewData;

    // in order to improve performance
    private coordinatesPerRoutePerSegment: Map<string, Coordinate[][]>;
    private coordinatesPerRoute: Map<string, Coordinate[]>;

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly host: MapComponent,
        private readonly routeEditPoiInteraction: RouteEditPoiInteraction,
        private readonly routeEditRouteInteraction: RouteEditRouteInteraction,
        private readonly snappingService: SnappingService) {
        super(resources);
        this.hoverViewCoordinates = null;
        this.coordinatesPerRoutePerSegment = new Map();
        this.coordinatesPerRoute = new Map();
        this.routeEditRouteInteraction.onRoutePointClick.subscribe((pointIndex: number) => {
            if (pointIndex == null || (this.routePointPopupData != null && this.routePointPopupData.segmentIndex === pointIndex)) {
                this.routePointPopupData = null;
                return;
            }
            let selectedRoute = this.selectedRouteService.getSelectedRoute();
            let segment = selectedRoute.segments[pointIndex];
            this.routePointPopupData = {
                latlng: segment.routePoint,
                segmentIndex: pointIndex,
            };
        });

        this.routeEditRouteInteraction.onPointerMove.subscribe(latLng => {
            this.hoverViewCoordinates = SpatialService.toViewCoordinate(latLng);
        });

        this.routeEditPoiInteraction.onPointerMove.subscribe(latLng => {
            this.hoverViewCoordinates = SpatialService.toViewCoordinate(latLng);
        });

        this.routes$.subscribe((routes) => {
            this.routeEditPoiInteraction.setActive(false);
            this.routeEditRouteInteraction.setActive(false);
            this.snappingService.enable(this.isEditMode());
            if (!this.isEditMode()) {
                this.hoverViewCoordinates = null;
            }
            this.setInteractionAccordingToState();
            this.coordinatesPerRoutePerSegment = new Map();
            this.coordinatesPerRoute = new Map();
            for (let route of routes) {
                let coordinatesArray = route.segments.map(s => s.latlngs.map(l => SpatialService.toCoordinate(l)));
                this.coordinatesPerRoutePerSegment.set(route.id, coordinatesArray);
                let routeCoordinates = [].concat.apply([],coordinatesArray); // flatten
                this.coordinatesPerRoute.set(route.id, routeCoordinates);
            }
        });
    }

    private setInteractionAccordingToState() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return;
        }
        if (selectedRoute.state === "Poi") {
            this.routeEditPoiInteraction.setActive(true);
        } else if (selectedRoute.state === "Route") {
            this.routeEditRouteInteraction.setActive(true);
        }
    }

    private getMarkerIconStyle(feature: FeatureComponent) {
        let routeIdAndMarkerIndex = RouteEditPoiInteraction.getRouteAndMarkerIndex(feature.instance.getId().toString());
        let route = this.selectedRouteService.getRouteById(routeIdAndMarkerIndex.routeId);
        let marker = route.markers[routeIdAndMarkerIndex.index];
        let icon = "icon-" + (marker.type || "star");
        return [
            new style.Style({
                text: new style.Text({
                    font: "normal 32px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon("icon-map-marker"),
                    fill: new style.Fill({
                        color: "rgba(0,0,0,0.5)"
                    }),
                    offsetY: -12,
                    offsetX: 2
                }),
            }),
            new style.Style({
                text: new style.Text({
                    font: "normal 32px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon("icon-map-marker"),
                    fill: new style.Fill({
                        color: route.color
                    }),
                    offsetY: -14
                }),
            }),
            new style.Style({
                text: new style.Text({
                    font: "normal 18px IsraelHikingMap",
                    text: this.resources.getCharacterForIcon(icon),
                    offsetY: -16,
                    fill: new style.Fill({
                        color: "white"
                    })
                }),
            })
        ];
    }

    public ngAfterViewInit(): void {
        this.routeEditPoiInteraction.setActive(false);
        this.routeEditRouteInteraction.setActive(false);
        this.host.instance.addInteraction(this.routeEditPoiInteraction);
        this.host.instance.addInteraction(this.routeEditRouteInteraction);
        this.setInteractionAccordingToState();
        this.routeMarkers.forEach(m => m.instance.setStyle(this.getMarkerIconStyle(m)));
        this.routeMarkers.changes.subscribe(() => {
            this.routeMarkers.forEach(m => m.instance.setStyle(this.getMarkerIconStyle(m)));
        });
    }

    private isEditMode(): boolean {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route");
    }

    public getSegmentCoordinates(routeId: string, segmentIndex: number) {
        return this.coordinatesPerRoutePerSegment.get(routeId)[segmentIndex];
    }

    public getRouteCoordinates(routeId: string) {
        return this.coordinatesPerRoute.get(routeId);
    }

    public getIdForMarker(route: RouteData, index: number) {
        return RouteEditPoiInteraction.createMarkerId(route, index);
    }

    public getIdForSegment(route: RouteData, index: number) {
        return RouteEditRouteInteraction.createSegmentId(route, index);
    }

    public getIdForSegmentPoint(route: RouteData, index: number) {
        return RouteEditRouteInteraction.createSegmentPointId(route, index);
    }

    public getColor(route: RouteData) {
        let colorArray = parse(route.color).values;
        colorArray.push(route.opacity);
        return colorArray;
    }

    public getHoverColor() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return this.getColor(selectedRoute);
    }

    public getRouteMarkerColor(segmentIndex: number, routeData: RouteData, stroke: boolean) {
        if (segmentIndex === 0) {
            return "#43a047";
        }
        if (this.isLast(segmentIndex, routeData)) {
            return "red";
        }
        if (stroke) {
            return "white";
        }
        return this.getColor(routeData);
    }

    public isLast(segmentIndex: number, routeData: RouteData) {
        return segmentIndex === routeData.segments.length - 1;
    }

    public getSegmentRotation(segment: RouteSegmentData) {
        let last = segment.latlngs.length - 1;
        if (last === 0) {
            return 0;
        }
        let dx = segment.latlngs[last].lng - segment.latlngs[last - 1].lng;
        let dy = segment.latlngs[last].lat - segment.latlngs[last - 1].lat;
        return -Math.atan2(dy, dx);
    }
}