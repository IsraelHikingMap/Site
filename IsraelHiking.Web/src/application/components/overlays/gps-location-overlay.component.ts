import { Component, Input, Output, EventEmitter } from "@angular/core";
import { MatLegacyDialog as MatDialog } from "@angular/material/legacy-dialog";
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

    @Select((state: ApplicationState) => state.inMemoryState.distance)
    public distance$: Observable<boolean>;

    public hideCoordinates: boolean;

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly runningContextService: RunningContextService,
                private readonly socialSharing: SocialSharing,
                private readonly hashService: HashService,
                private readonly toastService: ToastService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        this.hideCoordinates = true;
    }

    public addPointToRoute() {
        let markerData = {
            latlng: { ...this.latlng },
            title: "",
            description: "",
            type: "star",
            urls: [] as LinkData[]
        };
        if (this.ngRedux.getState().recordedRouteState.isRecording) {
            this.ngRedux.dispatch(new AddRecordingPoiAction({
                markerData
            }));
            let markerIndex = this.ngRedux.getState().recordedRouteState.route.markers.length - 1;
            PrivatePoiEditDialogComponent.openDialog(this.matDialog, markerData, markerIndex);
        } else {
            let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
            let markerIndex = selectedRoute.markers.length;
            this.ngRedux.dispatch(new AddPrivatePoiAction({
                routeId: selectedRoute.id,
                markerData
            }));
            PrivatePoiEditDialogComponent.openDialog(
                this.matDialog, markerData, markerIndex, selectedRoute.id);
        }
        this.closed.emit();
    }

    public openAddSimplePointDialog() {
        if (this.ngRedux.getState().userState.userInfo == null) {
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
