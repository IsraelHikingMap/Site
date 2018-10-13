import { Component, AfterViewInit } from "@angular/core";
import { MapComponent } from "ngx-openlayers";
import { Coordinate } from "openlayers";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";
import parse from "color-parse";

import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../services/spatial.service";
import { LatLngAlt, ApplicationState, RouteData, RouteSegmentData, ICoordinate } from "../models/models";
import { RouteEditPoiInteraction } from "./intercations/route-edit-poi.interaction";
import { RouteEditRouteInteraction } from "./intercations/route-edit-route.interaction";

interface RoutePointViewData {
    latlng: LatLngAlt;
    close: Function;
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
        private readonly routeEditRouteInteraction: RouteEditRouteInteraction, ) {
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
                close: () => this.routePointPopupData = null
            };
        });

        this.routes.subscribe(() => {
            this.routeEditPoiInteraction.setActive(false);
            this.routeEditRouteInteraction.setActive(false);
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
        this.host.instance.on("pointermove",
            (event: ol.MapBrowserEvent) => {
                if (this.isEditMode()) {
                    this.hoverViewCoordinates = event.coordinate;
                } else {
                    this.hoverViewCoordinates = null;
                }
            });
        this.routeEditPoiInteraction.setActive(false);
        this.routeEditRouteInteraction.setActive(false);
        this.host.instance.addInteraction(this.routeEditPoiInteraction);
        this.host.instance.addInteraction(this.routeEditRouteInteraction);
    }

    private isEditMode() {
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
}