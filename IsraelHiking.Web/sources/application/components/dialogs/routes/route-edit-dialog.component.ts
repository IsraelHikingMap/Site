import { Component, ViewEncapsulation } from "@angular/core";
import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { FileService } from "../../../services/file.service";
import { FitBoundsService } from "../../../services/fit-bounds.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesService } from "../../../services/layers/routelayers/routes.service";
import { IRouteLayer } from "../../../services/layers/routelayers/iroute.layer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "route-edit-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.css"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteEditDialogComponent extends RouteBaseDialogComponent {
    private routeLayer: IRouteLayer;

    constructor(resources: ResourcesService,
        mapService: MapService,
        routesService: RoutesService,
        routeLayerFactory: RouteLayerFactory,
        toastService: ToastService,
        private readonly fileService: FileService,
        private readonly fitBoundsService: FitBoundsService
    ) {
        super(resources, mapService, routesService, routeLayerFactory, toastService);

        this.isNew = false;
        this.title = this.resources.routeProperties;
    }

    public setRouteLayer(name: string): void {
        this.routeLayer = this.routesService.getRouteByName(name);
        this.routeProperties = { ...this.routeLayer.route.properties };
        this.pathOptions = { ...this.routeProperties.pathOptions };
    }

    protected isRouteNameAlreadyInUse() {
        return this.routeProperties.name !== this.routeLayer.route.properties.name &&
            this.routesService.isNameAvailable(this.routeProperties.name) === false;
    }

    public saveRoute(e: Event) {
        super.saveRoute(e);
        this.routeLayer.setRouteProperties(this.routeProperties);
    }

    public deleteRoute(e: Event) {
        this.routesService.removeRoute(this.routeLayer.route.properties.name);
        this.suppressEvents(e);
    }

    public saveRouteToFile(e: Event): void {
        let data = {
            routes: [this.routeLayer.getData()]
        } as Common.DataContainer;
        this.fileService.saveToFile(this.routeProperties.name + ".gpx", "gpx", data)
            .then(() => { }, () => {
                this.toastService.error(this.resources.unableToSaveToFile);
            });
        this.suppressEvents(e);
    }

    public moveToRoute = (e: Event) => {
        let bounds = this.routeLayer.getBounds();
        if (bounds == null) {
            this.toastService.error(this.resources.pleaseAddPointsToRoute);
            return;
        }
        if (!this.routeProperties.isVisible) {
            this.toastService.warning(this.resources.routeIsHidden);
        }
        this.fitBoundsService.fitBounds(bounds);
        this.suppressEvents(e);
    }

    public makeAllPointsEditable = () => {
        this.routeLayer.makeAllPointsEditable();
        this.toastService.info(this.resources.dataUpdatedSuccefully);
    }
}