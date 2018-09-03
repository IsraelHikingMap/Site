import { Component, ApplicationRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
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
        private readonly routesService: RoutesService) {
        super(resources, httpClient, applicationRef, elevationProvider);
    }

    public addPointToRoute() {
        let selectedRoute = this.routesService.getOrCreateSelectedRoute();
        let stateName = selectedRoute.getStateName();
        selectedRoute.setHiddenState();
        selectedRoute.route.markers.push({
            latlng: this.latLng,
            title: this.title,
            description: "",
            type: "star",
            id: "",
            urls: [],
            marker: null
        } as IMarkerWithData);
        selectedRoute.setState(stateName);
        selectedRoute.raiseDataChanged();
        this.marker.closePopup();
    }
}