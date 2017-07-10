import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";

@Component({
    selector: "route-add-dialog",
    templateUrl: "./route-properties-dialog.component.html"
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
