import { Component, ApplicationRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import {RouteLayerFactory} from "../../services/layers/routelayers/route-layer.factory";
import {IMarkerWithData} from "../../services/layers/routelayers/iroute.layer";


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
        if (this.routesService.selectedRoute == null && this.routesService.routes.length > 0) {
            this.routesService.changeRouteState(this.routesService.routes[0]);
        }
        if (this.routesService.routes.length === 0) {
            let properties = this.routeLayerFactory.createRoute(this.routesService.createRouteName()).properties;
            this.routesService.addRoute({ properties: properties, segments: [], markers: [] });
            this.routesService.selectedRoute.setEditMode("None");
        }
        let editMode = this.routesService.selectedRoute.getEditMode();
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
        this.routesService.selectedRoute.setEditMode(editMode);
        this.routesService.selectedRoute.raiseDataChanged();
        this.marker.closePopup();
    }
}