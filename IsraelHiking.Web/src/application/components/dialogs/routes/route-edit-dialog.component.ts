import { Component, ViewEncapsulation, inject } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";

import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { SpatialService } from "../../../services/spatial.service";
import { DeleteRouteAction, ChangeRoutePropertiesAction } from "../../../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../../../reducers/route-editing.reducer";
import type { DataContainer, RouteData, LatLngAlt } from "../../../models/models";

@Component({
    selector: "route-edit-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteEditDialogComponent extends RouteBaseDialogComponent {
    private originalName: string;

    private readonly fileService: FileService = inject(FileService);
    private readonly fitBoundsService: FitBoundsService = inject(FitBoundsService);
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
