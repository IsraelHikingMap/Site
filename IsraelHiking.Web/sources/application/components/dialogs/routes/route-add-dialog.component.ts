import { Component, ViewEncapsulation } from "@angular/core";
import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesService } from "../../../services/layers/routelayers/routes.service";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";

@Component({
    selector: "route-add-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteAddDialogComponent extends RouteBaseDialogComponent {
    constructor(resources: ResourcesService,
        mapService: MapService,
        routesService: RoutesService,
        routeLayerFactory: RouteLayerFactory,
        toastService: ToastService
    ) {
        super(resources, mapService, routesService, routeLayerFactory, toastService);
        this.routeProperties = routeLayerFactory.createRoute(routesService.createRouteName()).properties;
        this.pathOptions = this.routeProperties.pathOptions;
        this.isNew = true;
        this.title = this.resources.addRoute;
    }

    public saveRoute(e: Event) {
        super.saveRoute(e);
        this.routesService.addRoute({ properties: this.routeProperties, segments: [], markers: [] });
    }
}
