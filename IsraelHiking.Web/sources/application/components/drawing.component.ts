import { Component, HostListener } from "@angular/core";
import { ESCAPE } from "@angular/cdk/keycodes";

import { ResourcesService } from "../services/resources.service";
import { RoutesService } from "../services/layers/routelayers/routes.service";
import { RouteLayerFactory } from "../services/layers/routelayers/route-layer.factory";
import { BaseMapComponent } from "./base-map.component";
import * as Common from "../common/IsraelHiking";


@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html"
})
export class DrawingComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private readonly routesService: RoutesService,
        private readonly routeLayerFactory: RouteLayerFactory) {
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
            if (this.isPoiEditActive()) {
                this.toggleEditPoi($event);
            }
            if (this.isRouteEditActive()) {
                this.toggleEditRoute($event);
            }
        }
    }

    public clear(e: Event) {
        this.suppressEvents(e);
        let layer = this.routesService.selectedRoute;
        if (layer != null) {
            layer.clear();
        }
    }

    public isPoiEditActive() {
        return this.routesService.selectedRoute != null &&
            (this.routesService.selectedRoute.getStateName() === "Poi" ||
                this.routesService.selectedRoute.getStateName() === "RecordingPoi");
    }

    public isRouteEditActive() {
        return this.routesService.selectedRoute != null && this.routesService.selectedRoute.getStateName() === "Route";
    }

    public isEditActive() {
        return this.isPoiEditActive() || this.isRouteEditActive();
    }

    public isRouteEditDisabled() {
        return this.routesService.selectedRoute != null &&
        (this.routesService.selectedRoute.getStateName() === "Recording" ||
            this.routesService.selectedRoute.getStateName() === "RecordingPoi");
    }

    public toggleEditRoute(e: Event) {
        this.suppressEvents(e);
        let selectedRoute = this.routesService.getOrCreateSelectedRoute();
        let stateName = selectedRoute.getStateName();
        switch (stateName) {
            case "Route":
                selectedRoute.setReadOnlyState();
                break;
            case "Recording":
            case "RecordingPoi":
                break;
            default:
                selectedRoute.setEditRouteState();
                break;
        }
    }

    public toggleEditPoi(e: Event) {
        this.suppressEvents(e);
        let selectedRoute = this.routesService.getOrCreateSelectedRoute();
        let stateName = selectedRoute.getStateName();
        switch (stateName) {
            case "Poi":
                selectedRoute.setReadOnlyState();
                break;
            case "RecordingPoi":
                selectedRoute.setRecordingState();
                break;
            case "Recording":
                selectedRoute.setRecordingPoiState();
                break;
            default:
                selectedRoute.setEditPoiState();
                break;
        }
    }

    public setRouting(routingType: Common.RoutingType, e: Event) {
        this.suppressEvents(e);
        if (this.routesService.selectedRoute == null) {
            return;
        }
        this.routeLayerFactory.routingType = routingType;
        this.routesService.selectedRoute.setRoutingType(routingType);
    }

    public undo = (e: Event) => {
        this.suppressEvents(e);
        let layer = this.routesService.selectedRoute;
        if (layer != null) {
            layer.undo();
        }
    }

    public getRoutingType = (): Common.RoutingType => {
        if (this.routesService.selectedRoute == null) {
            return "None";
        }
        return this.routesService.selectedRoute.route.properties.currentRoutingType;
    }

    public isUndoDisabled = (): boolean => {
        let layer = this.routesService.selectedRoute;
        return layer != null ? layer.isUndoDisabled() : true;
    }

    public getRouteColor = (): string => {
        if (this.routesService.selectedRoute == null) {
            return "black";
        }
        return this.routesService.selectedRoute.route.properties.pathOptions.color;
    }
}