import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService, IOverlay } from "../../../services/layers/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import { LayerData } from "../../../models/models";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class OverlayEditDialogComponent extends LayerBaseDialogComponent {
    private overlay: IOverlay;

    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        toastService: ToastService,
        http: HttpClient) {
        super(resources, mapService, layersService, toastService, http);
        this.title = this.resources.overlayProperties;
        this.isNew = false;
        this.isOverlay = true;
    }

    public setOverlay(layer: IOverlay) {
        this.overlay = layer;
        this.key = this.overlay.key;
        this.maxZoom = this.overlay.maxZoom;
        this.minZoom = this.overlay.minZoom;
        this.address = this.overlay.address;
        this.opacity = this.overlay.opacity || 1.0;
    }

    public removeLayer(e: Event) {
        this.layersService.removeOverlay(this.overlay);
        this.suppressEvents(e);
    }

    protected internalSave(layerData: LayerData): void {
        this.layersService.updateOverlay(this.overlay, layerData);
    }
}