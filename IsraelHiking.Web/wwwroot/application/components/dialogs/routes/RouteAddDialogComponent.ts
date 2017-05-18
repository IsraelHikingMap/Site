import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService } from "../../../services/layers/LayersService";
import { IRouteProperties } from "../../../services/layers/routelayers/IRouteLayer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/RouteLayerFactory";
import { RouteBaseDialogComponent } from "./RouteBaseDialogComponent";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "route-add-dialog",
    templateUrl: "application/components/dialogs/routes/routePropertiesDialog.html"
})
export class RouteAddDialogComponent extends RouteBaseDialogComponent {
    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        routeLayerFactory: RouteLayerFactory,
        toastService: ToastService
    ) {
        super(resources, mapService, layersService, routeLayerFactory, toastService);
        this.routeProperties = routeLayerFactory.createRoute(layersService.createRouteName()).properties;
        this.pathOptions = this.routeProperties.pathOptions;
        this.isNew = true;
        this.title = this.resources.addRoute;
    }

    public saveRoute(e: Event): boolean {
        if (!super.saveRoute(e)) {
            return false;
        }
        this.layersService.addRoute({ properties: this.routeProperties, segments: [], markers: [] });
        return true;
    }
}
