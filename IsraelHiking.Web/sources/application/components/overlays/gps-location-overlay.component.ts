import { Component } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";
import { ApplicationState } from "../../models/models";
import { ClosableOverlayComponent } from "./closable-overlay.component";

@Component({
    selector: "gps-location-overlay",
    templateUrl: "./gps-location-overlay.component.html"
})
export class GpsLocationOverlayComponent extends ClosableOverlayComponent {

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.hideCoordinates = true;
    }

    public addPointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: selectedRoute.id,
            markerData: {
                latlng: this.latlng,
                title: "",
                description: "",
                type: "star",
                urls: []
            }
        }));
        this.close();
    }
}