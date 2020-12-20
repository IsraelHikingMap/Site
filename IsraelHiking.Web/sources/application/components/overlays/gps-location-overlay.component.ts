import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatDialog } from "@angular/material";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { WebIntent } from '@ionic-native/web-intent/ngx';

import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { AddSimplePoiDialogComponent } from "../dialogs/add-simple-poi-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { RunningContextService } from "../../services/running-context.service";
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
                private readonly runningContextService: RunningContextService,
                private readonly webIntent: WebIntent,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.hideCoordinates = true;
    }

    public addPointToRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        let markerIndex = selectedRoute.markers.length;
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
            this.matDialog, markerData, selectedRoute.id, markerIndex);
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

    public canShareLocation() {
        return this.runningContextService.isCordova && !this.runningContextService.isIos;
    }

    public shareMyLocation() {
        this.webIntent.startActivity({
            action: this.webIntent.ACTION_VIEW,
            url: `geo:${this.latlng.lat},${this.latlng.lng}`
        });
        this.closed.emit();
    }
}
