import { Component, ViewEncapsulation, Inject } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { NgRedux } from "@angular-redux2/store";

import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { ResourcesService } from "../../../services/resources.service";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { SpatialService } from "../../../services/spatial.service";
import { DeleteRouteAction, ChangeRoutePropertiesAction } from "../../../reducers/routes.reducer";
import type { DataContainer, RouteData, ApplicationState, LatLngAlt } from "../../../models/models";

@Component({
    selector: "route-edit-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteEditDialogComponent extends RouteBaseDialogComponent {
    private originalName: string;

    constructor(resources: ResourcesService,
                selectedRouteService: SelectedRouteService,
                routesFactory: RoutesFactory,
                toastService: ToastService,
                ngRedux: NgRedux<ApplicationState>,
                private readonly fileService: FileService,
                private readonly fitBoundsService: FitBoundsService,
                @Inject(MAT_DIALOG_DATA) data: RouteData
    ) {
        super(resources, selectedRouteService, routesFactory, toastService, ngRedux);

        this.isNew = false;
        this.title = this.resources.routeProperties;
        this.routeData = data;
        this.originalName = data.name;
    }

    protected saveImplementation() {
        this.ngRedux.dispatch(new ChangeRoutePropertiesAction({
            routeId: this.routeData.id,
            routeData: this.routeData
        }));
    }

    protected isRouteNameAlreadyInUse() {
        return this.routeData.name !== this.originalName &&
            this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
    }

    public deleteRoute() {
        this.ngRedux.dispatch(new DeleteRouteAction({
            routeId: this.routeData.id
        }));
    }

    public async saveRouteToFile() {
        let latLngs = this.getLatlngs();
        if (latLngs.length === 0) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        let data = {
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
        let latLngs = this.getLatlngs();
        if (latLngs.length === 0) {
            this.toastService.error(new Error("Route data is empty"), this.resources.pleaseAddPointsToRoute);
            return;
        }
        let bounds = SpatialService.getBounds(latLngs);
        if (this.routeData.state === "Hidden") {
            this.toastService.warning(this.resources.routeIsHidden);
        }
        this.fitBoundsService.fitBounds(bounds);
    };

    private getLatlngs(): LatLngAlt[] {
        let latLngs: LatLngAlt[] = [];
        for (let segment of this.routeData.segments) {
            latLngs = latLngs.concat(segment.latlngs);
        }
        for (let markers of this.routeData.markers) {
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
