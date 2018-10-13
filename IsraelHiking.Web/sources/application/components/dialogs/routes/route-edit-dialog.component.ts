import { Component, ViewEncapsulation } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../../../services/resources.service";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { ToastService } from "../../../services/toast.service";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { SpatialService } from "../../../services/spatial.service";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { DeleteRouteAction, ChangeRoutePropertiesAction } from "../../../reducres/routes.reducer";
import { DataContainer, RouteData, ApplicationState, LatLngAlt } from "../../../models/models";

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
        routeLayerFactory: RouteLayerFactory,
        toastService: ToastService,
        ngRedux: NgRedux<ApplicationState>,
        private readonly fileService: FileService,
        private readonly fitBoundsService: FitBoundsService
    ) {
        super(resources, selectedRouteService, routeLayerFactory, toastService, ngRedux);

        this.isNew = false;
        this.title = this.resources.routeProperties;
    }

    protected saveImplementation() {
        this.ngRedux.dispatch(new ChangeRoutePropertiesAction({
            routeId: this.routeData.id,
            routeData: this.routeData
        }));
    }

    public setRouteData(routeData: RouteData): void {
        this.routeData = { ...routeData };
        this.originalName = routeData.name;
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
            this.toastService.error(this.resources.pleaseAddPointsToRoute);
            return;
        }
        let data = {
            routes: [this.routeData]
        } as DataContainer;
        try {
            let showToast = await this.fileService.saveToFile(this.routeData.name + ".gpx", "gpx", data);
            if (showToast) {
                this.toastService.success(this.resources.fileSavedSuccessfully);
            }
        } catch (ex) {
            this.toastService.error(this.resources.unableToSaveToFile);
        }
    }

    public moveToRoute = () => {
        let latLngs = this.getLatlngs();
        if (latLngs.length === 0) {
            this.toastService.error(this.resources.pleaseAddPointsToRoute);
            return;
        }
        let bounds = SpatialService.getBounds(latLngs);
        if (this.routeData.state === "Hidden") {
            this.toastService.warning(this.resources.routeIsHidden);
        }
        this.fitBoundsService.fitBounds(bounds);
    }

    private getLatlngs(): LatLngAlt[] {
        let latLngs = [];
        for (let segment of this.routeData.segments) {
            latLngs = latLngs.concat(segment.latlngs);
        }
        for (let markers of this.routeData.markers) {
            latLngs.push(markers.latlng);
        }
        return latLngs;
    }

    public makeAllPointsEditable = () => {
        this.toastService.info(this.resources.dataUpdatedSuccessfully);
        // HM TODO: support this
        throw new Error("Not implemented");
        // this.routeLayer.makeAllPointsEditable();

    }
}