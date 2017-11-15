import { Component, HostListener } from "@angular/core";
import { ESCAPE } from "@angular/material";
import { ResourcesService } from "../services/resources.service";
import { MapService } from "../services/map.service";
import { RoutesService } from "../services/layers/routelayers/routes.service";
import { EditMode } from "../services/layers/routelayers/iroute-state";
import { EditModeString } from "../services/layers/routelayers/iroute.layer";
import { RouteLayerFactory } from "../services/layers/routelayers/route-layer.factory";
import { BaseMapComponent } from "./base-map.component";
import * as Common from "../common/IsraelHiking";


@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html"
})
export class DrawingComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private routesService: RoutesService,
        private routeLayerFactory: RouteLayerFactory) {
        super(resources);
    }

    @HostListener("window:keydown", ["$event"])
    public onDrawingShortcutKeys($event: KeyboardEvent) {
        if (this.routesService.selectedRoute == null) {
            return;
        }   
        if ($event.ctrlKey && String.fromCharCode($event.which).toLowerCase() === "z") {
            this.undo($event);
        } else if ($event.keyCode === ESCAPE) {
            this.setEditMode(EditModeString.none, $event);
        }
    }

    public clear(e: Event) {
        this.suppressEvents(e);
        let layer = this.routesService.selectedRoute;
        if (layer != null) {
            layer.clear();
        }
    }

    public getEditMode(): EditMode {
        if (this.routesService.selectedRoute == null) {
            return EditModeString.none;
        }
        return this.routesService.selectedRoute.getEditMode();
    }

    public setEditMode(editMode: EditMode, e: Event) {
        this.suppressEvents(e);
        let selectedRoute = this.routesService.selectedRoute;
        if (selectedRoute == null && this.routesService.routes.length > 0) {
            this.routesService.changeRouteState(this.routesService.routes[0]);
            selectedRoute = this.routesService.selectedRoute;
        }
        if (selectedRoute == null && this.routesService.routes.length === 0) {
            let properties = this.routeLayerFactory.createRoute(this.routesService.createRouteName()).properties;
            this.routesService.addRoute({ properties: properties, segments: [], markers: [] });
            this.routesService.selectedRoute.setEditMode(editMode);
            return;
        }
        if (selectedRoute == null) {
            return;
        }
        if (this.getEditMode() === editMode) {
            selectedRoute.setReadOnlyState();
            return;
        }
        this.routesService.selectedRoute.setEditMode(editMode);
    };

    public setRouting(routingType: Common.RoutingType, e: Event) {
        this.suppressEvents(e);
        if (this.routesService.selectedRoute == null) {
            return;
        }
        this.routeLayerFactory.routingType = routingType;
        this.routesService.selectedRoute.setRoutingType(routingType);
    };

    public undo = (e: Event) => {
        this.suppressEvents(e);
        let layer = this.routesService.selectedRoute;
        if (layer != null) {
            layer.undo();
        }
    };

    public getRoutingType = (): Common.RoutingType => {
        if (this.routesService.selectedRoute == null) {
            return "None";
        }
        return this.routesService.selectedRoute.route.properties.currentRoutingType;
    };

    public isUndoDisabled = (): boolean => {
        let layer = this.routesService.selectedRoute;
        return layer != null ? layer.isUndoDisbaled() : true;
    };

    public isEditDisabled = (): boolean => {
        return this.routesService.selectedRoute == null;
    }
    
    public getRouteColor = (): string => {
        if (this.routesService.selectedRoute == null) {
            return "black";
        }
        return this.routesService.selectedRoute.route.properties.pathOptions.color;
    }
}