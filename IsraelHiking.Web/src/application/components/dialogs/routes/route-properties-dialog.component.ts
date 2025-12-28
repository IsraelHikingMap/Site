import { Component, inject, ViewEncapsulation } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatMiniFabButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatError, MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { NgStyle } from "@angular/common";
import { MatSlider, MatSliderThumb } from "@angular/material/slider";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatTooltip } from "@angular/material/tooltip";
import { MAT_DIALOG_DATA, MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import invert from "invert-color";
import { Store } from "@ngxs/store";

import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SpatialService } from "../../../services/spatial.service";
import { SetOpacityAndWeightAction, SetSelectedRouteAction } from "../../../reducers/route-editing.reducer";
import { AddRouteAction, ChangeRoutePropertiesAction, DeleteRouteAction } from "../../../reducers/routes.reducer";
import type { DataContainer, LatLngAlt, RouteData } from "../../../models";

export type RoutePropertiesDialogData = {
    routeData: RouteData;
    isNew: boolean;
};

@Component({
    selector: "route-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatMiniFabButton, MatSlider, MatSliderThumb, NgStyle, MatDialogActions, MatMenu, MatMenuItem, Angulartics2OnModule, MatMenuTrigger, MatTooltip, MatError, NameInUseValidatorDirective]
})
export class RoutePropertiesDialogComponent {
    public colors: string[];
    public isNew: boolean;
    public title: string;
    public isReversed: boolean;

    public routeData: RouteData;

    public readonly resources = inject(ResourcesService);

    private originalName: string;

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    private readonly fileService = inject(FileService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly data = inject<RoutePropertiesDialogData>(MAT_DIALOG_DATA);

    constructor() {
        this.colors = this.routesFactory.colors;
        this.isNew = this.data.isNew;
        this.title = this.isNew ? this.resources.addRoute : this.resources.routeProperties;
        this.routeData = this.data.routeData;
        this.originalName = this.data.routeData.name;
    }

    public saveRoute() {
        if (this.isRouteNameAlreadyInUse()) {
            this.routeData.name = this.selectedRouteService.createRouteName(this.routeData.name);
            this.toastService.warning(this.resources.routeNameAlreadyInUse);
        }
        this.saveImplementation();
        this.store.dispatch(new SetOpacityAndWeightAction(this.routeData.opacity, this.routeData.weight));
    }

    public getCheckIconColor(color: string) {
        return invert(color, true);
    }

    private isRouteNameAlreadyInUse(): boolean {
        if (this.data.isNew) {
            return this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
        }
        return this.routeData.name !== this.originalName &&
            this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
    }

    private saveImplementation(): void {
        if (this.data.isNew) {
            this.store.dispatch(new AddRouteAction(this.routeData));
            this.selectedRouteService.setSelectedRoute(this.routeData.id);
        } else {
            this.store.dispatch(new ChangeRoutePropertiesAction(this.routeData.id, this.routeData));
        }
    }

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

    public moveToRoute() {
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
    }

    public deleteRoute() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && selectedRoute.id === this.routeData.id) {
            this.store.dispatch(new SetSelectedRouteAction(null));
        }
        this.store.dispatch(new DeleteRouteAction(this.routeData.id));
    }

    public makeAllPointsEditable() {
        this.selectedRouteService.makeAllPointsEditable(this.routeData.id);
        this.toastService.info(this.resources.dataUpdatedSuccessfully);
    }

    public reverseRoute() {
        this.selectedRouteService.reverseRoute(this.routeData.id);
        this.toastService.info(this.resources.dataUpdatedSuccessfully);
    }
}
