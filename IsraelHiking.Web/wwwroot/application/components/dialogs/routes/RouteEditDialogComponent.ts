import { Component } from "@angular/core";
import { MdSnackBar } from "@angular/material";
import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { FileService } from "../../../services/FileService";
import { FitBoundsService } from "../../../services/FitBoundsService";
import { ToastService } from "../../../services/ToastService";
import { LayersService } from "../../../services/layers/LayersService";
import { IRouteProperties, IRouteLayer } from "../../../services/layers/routelayers/IRouteLayer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/RouteLayerFactory";
import { RouteBaseDialogComponent } from "./RouteBaseDialogComponent";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "route-edit-dialog",
    moduleId: module.id,
    templateUrl: "routePropertiesDialog.html"
})
export class RouteEditDialogComponent extends RouteBaseDialogComponent {
    private routeLayer: IRouteLayer;
    public isReversed: boolean;

    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        routeLayerFactory: RouteLayerFactory,
        toastService: ToastService,
        private fileService: FileService,
        private fitBoundsService: FitBoundsService
    ) {
        super(resources, mapService, layersService, routeLayerFactory, toastService);

        this.isNew = false;
        this.isReversed = false;
        this.title = this.resources.routeProperties;
    }

    public setRouteLayer(name: string): void {
        this.routeLayer = this.layersService.getRouteByName(name);
        this.routeProperties = { ...this.routeLayer.route.properties };
        this.pathOptions = { ...this.routeProperties.pathOptions };
    }

    protected isRouteNameAlreadyInUse() {
        return this.routeProperties.name !== this.routeLayer.route.properties.name &&
            this.layersService.isNameAvailable(this.routeProperties.name) === false;
    }

    public saveRoute(e: Event): boolean {
        if (!super.saveRoute(e)) {
            return false;
        }
        if (this.routeProperties.isVisible !== this.routeLayer.route.properties.isVisible) {
            this.layersService.changeRouteState(this.routeLayer);
        }
        if (this.isReversed) {
            this.routeLayer.reverse();
        }
        this.routeLayer.setRouteProperties(this.routeProperties);
        return true;
    }

    public deleteRoute(e: Event) {
        this.layersService.removeRoute(this.routeLayer.route.properties.name);
        this.suppressEvents(e);
    }

    public saveRouteToFile(e: Event): void {
        var data = {
            routes: [this.routeLayer.getData()]
        } as Common.DataContainer;
        this.fileService.saveToFile(this.routeProperties.name + ".gpx", "gpx", data)
            .then(() => { }, () => {
                this.toastService.error(this.resources.unableToSaveToFile);
            });
        this.suppressEvents(e);
    }

    public moveToRoute = (e: Event) => {
        if (this.routeLayer.getData().segments.length === 0) {
            this.toastService.error(this.resources.pleaseAddPointsToRoute);
            return;
        }
        if (!this.routeProperties.isVisible) {
            this.toastService.warning(this.resources.routeIsHidden);
        }
        let bounds = this.routeLayer.getBounds();
        if (bounds != null) {
            this.fitBoundsService.fitBounds(bounds);
        }
        this.suppressEvents(e);
    }

    public getRoutingIcon = () => {
        return this.routeProperties.isRoutingPerPoint
            ? "icon-routing-local"
            : "icon-routing-global";
    }
}