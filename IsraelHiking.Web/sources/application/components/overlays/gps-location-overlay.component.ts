import { Component, Input, Output, EventEmitter } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";
import { ApplicationState, LatLngAlt } from "../../models/models";
import { BaseMapComponent } from "../base-map.component";


@Component({
    selector: "gps-location-overlay",
    templateUrl: "./gps-location-overlay.component.html"
})
export class GpsLocationOverlayComponent extends BaseMapComponent {

    @Input()
    public latlng: LatLngAlt;

    @Output()
    public close = new EventEmitter();

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
                latlng: { ...this.latlng },
                title: "",
                description: "",
                type: "star",
                urls: []
            }
        }));
        this.close.emit();
    }
}