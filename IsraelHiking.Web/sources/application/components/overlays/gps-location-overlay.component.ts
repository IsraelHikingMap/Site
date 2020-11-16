import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatDialog } from "@angular/material";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { AddSimplePoiDialogComponent } from "../dialogs/add-simple-poi-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { AddPrivatePoiAction } from "../../reducres/routes.reducer";
import { ToggleDistanceAction } from "../../reducres/in-memory.reducer";
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

    @select((state: ApplicationState) => state.inMemoryState.distance)
    public distance$: Observable<boolean>;

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

    public toggleDistance() {
        this.ngRedux.dispatch(new ToggleDistanceAction());
        this.closed.emit();
    }
}
