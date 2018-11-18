import { Component, AfterViewInit } from "@angular/core";
import { MapComponent } from "ngx-openlayers";
import { Coordinate } from "openlayers";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";
import parse from "color-parse";

import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../services/spatial.service";
import { RouteEditPoiInteraction } from "../intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "../intercations/route-edit-route.interaction";
import { SnappingService } from "../../services/snapping.service";
import { LatLngAlt, ApplicationState, RouteData, RouteSegmentData, ICoordinate } from "../../models/models";

interface RoutePointViewData {
    latlng: LatLngAlt;
    segmentIndex: number;
}

@Component({
    selector: "routes",
    templateUrl: "./routes.component.html"
})
export class RoutesComponent implements AfterViewInit {
    @select((state: ApplicationState) => state.routes.present)
    public routes: Observable<RouteData[]>;

    public hoverViewCoordinates: Coordinate;
    public routePointPopupData: RoutePointViewData;

    constructor(private readonly selectedRouteService: SelectedRouteService,
        private readonly host: MapComponent,
        private readonly routeEditPoiInteraction: RouteEditPoiInteraction,
        private readonly routeEditRouteInteraction: RouteEditRouteInteraction,
        private readonly snappingService: SnappingService) {
        this.hoverViewCoordinates = null;

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

        this.routes.subscribe(() => {
            this.routeEditPoiInteraction.setActive(false);
            this.routeEditRouteInteraction.setActive(false);
            this.snappingService.enable(this.isEditMode());
            if (!this.isEditMode()) {
                this.hoverViewCoordinates = null;
            }
            let selectedRoute = this.selectedRouteService.getSelectedRoute();
            if (selectedRoute == null) {
                return;
            }
            if (selectedRoute.state === "Poi") {
                this.routeEditPoiInteraction.setActive(true);
            } else if (selectedRoute.state === "Route") {
                this.routeEditRouteInteraction.setActive(true);
            }
        });
    }

    public ngAfterViewInit(): void {
        this.routeEditPoiInteraction.setActive(false);
        this.routeEditRouteInteraction.setActive(false);
        this.host.instance.addInteraction(this.routeEditPoiInteraction);
        this.host.instance.addInteraction(this.routeEditRouteInteraction);
    }

    private isEditMode(): boolean {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && (selectedRoute.state === "Poi" || selectedRoute.state === "Route");
    }

    public getSegmentCoordinates(segment: RouteSegmentData) {
        return segment.latlngs.map(l => SpatialService.toCoordinate(l));
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

    public getRouteMarkerColor(segmentIndex: number, routeData: RouteData) {
        if (segmentIndex === 0) {
            return "green";
        }
        if (segmentIndex === routeData.segments.length - 1) {
            return "red";
        }
        return routeData.color;
    }

    public getSegmentRotation(segment: RouteSegmentData) {
        let last = segment.latlngs.length - 1;
        let dx = segment.latlngs[last].lng - segment.latlngs[last - 1].lng;
        let dy = segment.latlngs[last].lat - segment.latlngs[last - 1].lat;
        return -Math.atan2(dy, dx);
    }
}