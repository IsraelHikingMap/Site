import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import { LayerData, Overlay } from "../../../models/models";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class OverlayEditDialogComponent extends LayerBaseDialogComponent {
    private overlay: Overlay;

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

    public setOverlay(layer: Overlay) {
        this.overlay = layer;
        this.key = this.overlay.key;
        this.maxZoom = this.overlay.maxZoom;
        this.minZoom = this.overlay.minZoom;
        this.address = this.overlay.address;
        this.opacity = this.overlay.opacity || 1.0;
    }

    public removeLayer() {
        this.layersService.removeOverlay(this.overlay);
    }

    protected internalSave(layerData: LayerData): void {
        let overlay = {
            ...layerData,
            id: this.overlay.id,
            isEditable: true,
            visible: true
        } as Overlay;
        this.layersService.updateOverlay(this.overlay, overlay);
    }
}
