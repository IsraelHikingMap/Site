import { Component, ApplicationRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { RouteLayerFactory } from "../../services/layers/routelayers/route-layer.factory";
import { IMarkerWithData } from "../../services/layers/routelayers/iroute.layer";


@Component({
    selector: "gps-location-marker-popup",
    templateUrl: "./gps-location-marker-popup.component.html"
})
export class GpsLocationMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private routesService: RoutesService,
        private routeLayerFactory: RouteLayerFactory) {
        super(resources, httpClient, applicationRef, elevationProvider);
    }

    public addPointToRoute() {
        let selectedRoute = this.routesService.getOrCreateSelectedRoute();
        let stateName = selectedRoute.getStateName();
        this.routesService.selectedRoute.setHiddenState();
        this.routesService.selectedRoute.route.markers.push({
            latlng: this.latLng,
            title: this.title,
            description: "",
            type: "star",
            id: "",
            urls: [],
            marker: null
        } as IMarkerWithData);
        this.routesService.selectedRoute.setState(stateName);
        this.routesService.selectedRoute.raiseDataChanged();
        this.marker.closePopup();
    }
}