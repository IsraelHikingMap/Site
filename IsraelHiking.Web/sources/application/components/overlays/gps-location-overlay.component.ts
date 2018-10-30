import { Component, Input, Output, EventEmitter } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";
import { BaseMapComponent } from "../base-map.component";
import { ApplicationState, LatLngAlt } from "../../models/models";

@Component({
    selector: "gps-location-overlay",
    templateUrl: "./gps-location-overlay.component.html"
})
export class GpsLocationOverlayComponent extends BaseMapComponent {

    @Input()
    public latlng: LatLngAlt;

    @Input()
    public isOpen: boolean;

    @Output()
    public closed: EventEmitter<any>;

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);

        this.closed = new EventEmitter();
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

    public close() {
        this.isOpen = false;
        this.closed.emit();
    }
}