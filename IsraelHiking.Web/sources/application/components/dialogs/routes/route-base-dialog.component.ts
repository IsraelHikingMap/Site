import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { IRouteProperties } from "../../../services/layers/routelayers/iroute.layer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { BaseMapComponent } from "../../base-map.component";

export abstract class RouteBaseDialogComponent extends BaseMapComponent {
    public routeProperties: IRouteProperties;
    public pathOptions: L.PathOptions;
    public colors: string[];
    public isNew: boolean;
    public isAdvanced: boolean;
    public title: string;
    public isReversed: boolean;

    constructor(resources: ResourcesService,
        protected mapService: MapService,
        protected layersService: LayersService,
        protected routeLayerFactory: RouteLayerFactory,
        protected toastService: ToastService) {
        super(resources);
        this.colors = this.routeLayerFactory.colors;
    }

    public setIsAdvanced(isAdvanced: boolean)
    {
        this.isAdvanced = isAdvanced;
    }

    protected updateLocalStorage() {
        this.routeLayerFactory.isRoutingPerPoint = this.routeProperties.isRoutingPerPoint;
        this.routeLayerFactory.routeOpacity = this.routeProperties.pathOptions.opacity;
    }

    public saveRoute(e: Event): boolean {
        this.suppressEvents(e);
        if (this.isRouteNameAlreadyInUse())
        {
            this.toastService.error(this.resources.routeNameAlreadyInUse);
            return false;
        }
        this.routeProperties.pathOptions = this.pathOptions;
        this.updateLocalStorage();
        return true;
    }

    protected isRouteNameAlreadyInUse(): boolean {
        return this.layersService.isNameAvailable(this.routeProperties.name) === false;
    }

    public saveRouteToFile(e: Event) { }
    public moveToRoute = (e: Event) => { }
    public deleteRoute(e: Event) { }
}