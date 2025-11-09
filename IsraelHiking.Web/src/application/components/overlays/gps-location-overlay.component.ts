import { Component, inject, input, output } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { AsyncPipe } from "@angular/common";
import { Share } from "@capacitor/share";
import { Angulartics2OnModule } from "angulartics2";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";
import { v4 as uuidv4 } from "uuid";

import { CoordinatesComponent } from "../coordinates.component";
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
import type { ApplicationState, LatLngAlt, LinkData, MarkerData } from "../../models";

@Component({
    selector: "gps-location-overlay",
    templateUrl: "./gps-location-overlay.component.html",
    imports: [Dir, MatButton, Angulartics2OnModule, MatTooltip, CoordinatesComponent, AsyncPipe]
})
export class GpsLocationOverlayComponent {

    public latlng = input<LatLngAlt>();

    public closed = output();

    public distance$: Observable<boolean>;
    public hideCoordinates: boolean = true;

    public readonly resources = inject(ResourcesService);

    private readonly matDialog = inject(MatDialog);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly hashService = inject(HashService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    constructor() {
        this.distance$ = this.store.select((state: ApplicationState) => state.inMemoryState.distance);
    }

    public addPointToRoute() {
        const markerData: MarkerData = {
            id: uuidv4(),
            latlng: { ...this.latlng() },
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
            id: uuidv4(),
            latlng: { ...this.latlng() },
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
        const coordinateUrl = this.hashService.getFullUrlFromLatLng(this.latlng());
        Share.share({
            text: `geo:${this.latlng().lat},${this.latlng().lng}\n${coordinateUrl}`
        });
        this.closed.emit();
    }
}
