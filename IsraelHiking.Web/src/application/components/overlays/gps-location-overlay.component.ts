import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Observable } from "rxjs";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { NgRedux, Select } from "@angular-redux2/store";

import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { AddSimplePoiDialogComponent } from "../dialogs/add-simple-poi-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { RunningContextService } from "../../services/running-context.service";
import { HashService } from "../../services/hash.service";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import { ToggleDistanceAction } from "../../reducers/in-memory.reducer";
import type { ApplicationState, LatLngAlt, LinkData } from "../../models/models";

@Component({
    selector: "gps-location-overlay",
    templateUrl: "./gps-location-overlay.component.html"
})
export class GpsLocationOverlayComponent extends BaseMapComponent {

    @Input()
    public latlng: LatLngAlt;

    @Output()
    public closed = new EventEmitter();

    @Select((state: ApplicationState) => state.inMemoryState.distance)
    public distance$: Observable<boolean>;

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly runningContextService: RunningContextService,
                private readonly socialSharing: SocialSharing,
                private readonly hashService: HashService,
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
            urls: [] as LinkData[]
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
        return this.runningContextService.isCapacitor;
    }

    public shareMyLocation() {
        let ihmCoordinateUrl = this.hashService.getFullUrlFromLatLng(this.latlng);
        this.socialSharing.shareWithOptions({
            message: `geo:${this.latlng.lat},${this.latlng.lng}\n${ihmCoordinateUrl}`
        });
        this.closed.emit();
    }
}
