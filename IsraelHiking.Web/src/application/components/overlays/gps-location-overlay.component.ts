import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { SocialSharing } from "@awesome-cordova-plugins/social-sharing/ngx";
import { Store } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { AddSimplePoiDialogComponent } from "../dialogs/add-simple-poi-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { RunningContextService } from "../../services/running-context.service";
import { HashService } from "../../services/hash.service";
import { ToastService } from "../../services/toast.service";
import { AddPrivatePoiAction } from "../../reducers/routes.reducer";
import { ToggleDistanceAction } from "../../reducers/in-memory.reducer";
import { AddRecordingPoiAction } from "../../reducers/recorded-route.reducer";
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

    public distance: boolean;
    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly runningContextService: RunningContextService,
                private readonly socialSharing: SocialSharing,
                private readonly hashService: HashService,
                private readonly toastService: ToastService,
                private readonly store: Store) {
        super(resources);
        this.hideCoordinates = true;
        this.store.select((state: ApplicationState) => state.inMemoryState.distance).subscribe((distance) => {
            this.distance = distance;
        });
    }

    public addPointToRoute() {
        const markerData = {
            latlng: { ...this.latlng },
            title: "",
            description: "",
            type: "star",
            urls: [] as LinkData[]
        };
        if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isRecording) {
            this.store.dispatch(new AddRecordingPoiAction(markerData));
            const markerIndex = this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).route.markers.length - 1;
            PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, markerIndex);
        } else {
            const selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
            const markerIndex = selectedRoute.markers.length;
            this.store.dispatch(new AddPrivatePoiAction(selectedRoute.id, markerData));
            PrivatePoiEditDialogComponent.openDialog(
                this.matDialog, markerData, markerIndex, selectedRoute.id);
        }
        this.closed.emit();
    }

    public openAddSimplePointDialog() {
        if (this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo == null) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
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
        this.store.dispatch(new ToggleDistanceAction());
        this.closed.emit();
    }

    public canShareLocation() {
        return this.runningContextService.isCapacitor;
    }

    public shareMyLocation() {
        const ihmCoordinateUrl = this.hashService.getFullUrlFromLatLng(this.latlng);
        this.socialSharing.shareWithOptions({
            message: `geo:${this.latlng.lat},${this.latlng.lng}\n${ihmCoordinateUrl}`
        });
        this.closed.emit();
    }
}
