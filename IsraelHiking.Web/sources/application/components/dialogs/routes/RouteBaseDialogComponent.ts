import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService } from "../../../services/layers/LayersService";
import { IRouteProperties } from "../../../services/layers/routelayers/IRouteLayer";
import { RouteLayerFactory } from "../../../services/layers/routelayers/RouteLayerFactory";
import { BaseMapComponent } from "../../BaseMapComponent";
import * as Common from "../../../common/IsraelHiking";

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