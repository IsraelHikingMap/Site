import { Component, HostListener } from "@angular/core";
import { ESCAPE } from "@angular/material";
import { ResourcesService } from "../services/resources.service";
import { MapService } from "../services/map.service";
import { LayersService } from "../services/layers/layers.service";
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

    public editMode: EditMode;

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private layersService: LayersService,
        private routeLayerFactory: RouteLayerFactory) {
        super(resources);

        this.editMode = EditModeString.none;

        this.layersService.routeChanged.subscribe(() => {
            this.editMode = (this.layersService.getSelectedRoute() != null) ? this.layersService.getSelectedRoute().getEditMode() : EditModeString.none;
        });
    }

    @HostListener("window:keydown", ["$event"])
    public onDrawingShortcutKeys($event: KeyboardEvent) {
        if (this.layersService.getSelectedRoute() == null) {
            return;
        }
        if ($event.ctrlKey && String.fromCharCode($event.which).toLowerCase() === "z") {
            this.undo($event);
        } else if ($event.keyCode === ESCAPE) {
            let layer = this.layersService.getSelectedRoute();
            if (layer != null) {
                layer.setReadOnlyState();
            }
            this.editMode = EditModeString.none;
        } else {
            return;
        }
    }

    public clear(e: Event) {
        this.suppressEvents(e);
        let layer = this.layersService.getSelectedRoute();
        if (layer != null) {
            layer.clear();
        }
    }

    public setEditMode(editMode: EditMode, e: Event) {
        this.suppressEvents(e);
        let selectedRoute = this.layersService.getSelectedRoute();
        if (this.editMode === editMode) {
            if (selectedRoute != null) {
                selectedRoute.setReadOnlyState();
            }
            this.editMode = EditModeString.none;
            return;
        }

        switch (editMode) {
            case EditModeString.poi:
                if (selectedRoute != null) {
                    selectedRoute.setEditPoiState();
                    this.editMode = editMode;
                }
                return;
            case EditModeString.route:
                if (selectedRoute != null) {
                    selectedRoute.setEditRouteState();
                    this.editMode = editMode;
                }
                return;
        }
    };

    public setRouting(routingType: Common.RoutingType, e: Event) {
        this.suppressEvents(e);
        if (this.layersService.getSelectedRoute() == null) {
            return;
        }
        this.routeLayerFactory.routingType = routingType;
        this.layersService.getSelectedRoute().setRoutingType(routingType);
    };

    public undo = (e: Event) => {
        this.suppressEvents(e);
        let layer = this.layersService.getSelectedRoute();
        if (layer != null) {
            layer.undo();
        }
    };

    public getRoutingType = (): Common.RoutingType => {
        if (this.layersService.getSelectedRoute() == null) {
            return "None";
        }
        return this.layersService.getSelectedRoute().route.properties.currentRoutingType;
    };

    public isUndoDisbaled = (): boolean => {
        let layer = this.layersService.getSelectedRoute();
        return layer != null ? layer.isUndoDisbaled() : true;
    };

    public getRouteColor = (): string => {
        if (this.layersService.getSelectedRoute() == null) {
            return "black";
        }
        return this.layersService.getSelectedRoute().route.properties.pathOptions.color;
    }
}