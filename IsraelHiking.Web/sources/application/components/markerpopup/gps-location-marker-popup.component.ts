import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { ApplicationState } from "../../models/models";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";


@Component({
    selector: "gps-location-marker-popup",
    templateUrl: "./gps-location-marker-popup.component.html"
})
export class GpsLocationMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources, httpClient, elevationProvider);
    }

    public addPointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: selectedRoute.id,
            markerData: {
                latlng: this.latLng,
                title: this.title,
                description: "",
                type: "star",
                urls: []
            }
        }));
        this.close();
    }
}