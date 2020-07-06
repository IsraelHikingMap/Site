import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatDialog } from "@angular/material";
import { NgRedux } from "@angular-redux/store";

import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { AddSimplePoiDialogComponent } from "../dialogs/add-simple-poi-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";
import { ApplicationState, LatLngAlt } from "../../models/models";

@Component({
    selector: "gps-location-overlay",
    templateUrl: "./gps-location-overlay.component.html"
})
export class GpsLocationOverlayComponent extends BaseMapComponent {

    @Input()
    public latlng: LatLngAlt;

    @Output()
    public closed = new EventEmitter();

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.hideCoordinates = true;
    }

    public addPointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        let markerData = {
            latlng: { ...this.latlng },
            title: "",
            description: "",
            type: "star",
            urls: []
        };
        this.ngRedux.dispatch(new AddPrivatePoiAction({
            routeId: selectedRoute.id,
            markerData
        }));
        PrivatePoiEditDialogComponent.openDialog(
            this.matDialog, markerData, selectedRoute.id, selectedRoute.markers.length - 1);
        this.closed.emit();
    }

    public openAddSimplePointDialog() {
        AddSimplePoiDialogComponent.openDialog(this.matDialog, {
            latlng: { ...this.latlng },
            description: "",
            imageLink: null,
            markerType: "star",
            title: ""
        });
        this.closed.emit();
    }
}
