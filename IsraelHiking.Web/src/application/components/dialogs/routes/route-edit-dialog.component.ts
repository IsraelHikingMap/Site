import { Component, ViewEncapsulation, Inject } from "@angular/core";
import { MAT_DIALOG_DATA } from "@angular/material/dialog";
import { Store } from "@ngxs/store";

import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { ResourcesService } from "../../../services/resources.service";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { SpatialService } from "../../../services/spatial.service";
import { DeleteRouteAction, ChangeRoutePropertiesActionAction } from "../../../reducers/routes.reducer";
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

    constructor(resources: ResourcesService,
                selectedRouteService: SelectedRouteService,
                routesFactory: RoutesFactory,
                toastService: ToastService,
                store: Store,
                private readonly fileService: FileService,
                private readonly fitBoundsService: FitBoundsService,
                @Inject(MAT_DIALOG_DATA) data: RouteData
    ) {
        super(resources, selectedRouteService, routesFactory, toastService, store);

        this.isNew = false;
        this.title = this.resources.routeProperties;
        this.routeData = data;
        this.originalName = data.name;
    }

    protected saveImplementation() {
        this.store.dispatch(new ChangeRoutePropertiesActionAction(this.routeData.id, this.routeData));
    }

    protected isRouteNameAlreadyInUse() {
        return this.routeData.name !== this.originalName &&
            this.selectedRouteService.isNameAvailable(this.routeData.name) === false;
    }

    public deleteRoute() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && selectedRoute.id === this.routeData.id) {
            this.store.dispatch(new SetSelectedRouteAction(null));
        }
        this.store.dispatch(new DeleteRouteAction(this.routeData.id));
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
