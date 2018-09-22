import { select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesService } from "../../../services/layers/routelayers/routes.service";
import { IRouteProperties } from "../../../services/layers/routelayers/iroute.layer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { BaseMapComponent } from "../../base-map.component";
import { IApplicationState } from "../../../state/models/application-state";

export abstract class RouteBaseDialogComponent extends BaseMapComponent {
    public routeProperties: IRouteProperties;
    public pathOptions: L.PathOptions;
    public colors: string[];
    public isNew: boolean;
    public title: string;
    public isReversed: boolean;

    @select((state: IApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

    constructor(resources: ResourcesService,
        protected readonly mapService: MapService,
        protected readonly routesService: RoutesService,
        protected readonly routeLayerFactory: RouteLayerFactory,
        protected readonly toastService: ToastService) {
        super(resources);
        this.colors = this.routeLayerFactory.colors;
    }

    protected updateLocalStorage() {
        this.routeLayerFactory.isRoutingPerPoint = this.routeProperties.isRoutingPerPoint;
        this.routeLayerFactory.routeOpacity = this.routeProperties.pathOptions.opacity;
    }

    public saveRoute(e: Event) {
        this.suppressEvents(e);
        if (this.isRouteNameAlreadyInUse()) {
            this.routeProperties.name = this.routesService.createRouteName(this.routeProperties.name);
            this.toastService.warning(this.resources.routeNameAlreadyInUse);
        }
        this.routeProperties.pathOptions = this.pathOptions;
        this.updateLocalStorage();
    }

    protected isRouteNameAlreadyInUse(): boolean {
        return this.routesService.isNameAvailable(this.routeProperties.name) === false;
    }

    public getRoutingIcon = () => {
        return this.routeProperties.isRoutingPerPoint
            ? "icon-routing-local"
            : "icon-routing-global";
    }

    public saveRouteToFile(e: Event) { }
    public moveToRoute = (e: Event) => { };
    public deleteRoute(e: Event) { }
    public makeAllPointsEditable = () => { };
}