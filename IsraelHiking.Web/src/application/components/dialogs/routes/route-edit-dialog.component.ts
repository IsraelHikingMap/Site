import { Component, ViewEncapsulation, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatMiniFabButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { NgStyle } from "@angular/common";
import { MatSlider, MatSliderThumb } from "@angular/material/slider";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatTooltip } from "@angular/material/tooltip";
import { MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { Angulartics2OnModule } from "angulartics2";

import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SpatialService } from "../../../services/spatial.service";
import { DeleteRouteAction, ChangeRoutePropertiesAction } from "../../../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../../../reducers/route-editing.reducer";
import type { DataContainer, RouteData, LatLngAlt } from "../../../models";

@Component({
    selector: "route-edit-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatMiniFabButton, MatSlider, MatSliderThumb, NgStyle, MatDialogActions, MatMenu, MatMenuItem, Angulartics2OnModule, MatMenuTrigger, MatTooltip]
})
export class RouteEditDialogComponent extends RouteBaseDialogComponent {
    private originalName: string;

    private readonly fileService = inject(FileService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly data = inject<RouteData>(MAT_DIALOG_DATA);

    constructor() {
        super();

        this.isNew = false;
        this.title = this.resources.routeProperties;
        this.routeData = this.data;
        this.originalName = this.data.name;
    }

    protected saveImplementation() {
        this.store.dispatch(new ChangeRoutePropertiesAction(this.routeData.id, this.routeData));
    }

    protected isRouteNameAlreadyInUse() {
        return this.routeData.name !== this.originalName &&
            this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
    }

    public deleteRoute() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && selectedRoute.id === this.routeData.id) {
            this.store.dispatch(new SetSelectedRouteAction(null));
        }
        this.store.dispatch(new DeleteRouteAction(this.routeData.id));
    }

    public async saveRouteToFile() {
        const latLngs = this.getLatlngs();
        if (latLngs.length === 0) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        const data = {
            routes: [this.routeData]
        } as DataContainer;
        try {
            await this.fileService.saveToFile(this.routeData.name + ".gpx", "gpx", data);
        } catch (ex) {
            this.toastService.error(ex, this.resources.unableToSaveToFile);
        }
    }

    // override base
    public moveToRoute = () => {
        const latLngs = this.getLatlngs();
        if (latLngs.length === 0) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        const bounds = SpatialService.getBounds(latLngs);
        if (this.routeData.state === "Hidden") {
            this.toastService.warning(this.resources.routeIsHidden);
        }
        this.fitBoundsService.fitBounds(bounds);
    };

    private getLatlngs(): LatLngAlt[] {
        let latLngs: LatLngAlt[] = [];
        for (const segment of this.routeData.segments) {
            latLngs = latLngs.concat(segment.latlngs);
        }
        for (const markers of this.routeData.markers) {
            latLngs.push(markers.latlng);
        }
        return latLngs;
    }

    // override base
    public makeAllPointsEditable = () => {
        this.selectedRouteService.makeAllPointsEditable(this.routeData.id);
        this.toastService.info(this.resources.dataUpdatedSuccessfully);
    };

    // override base
    public reverseRoute = () => {
        this.selectedRouteService.reverseRoute(this.routeData.id);
        this.toastService.info(this.resources.dataUpdatedSuccessfully);
    };
}
