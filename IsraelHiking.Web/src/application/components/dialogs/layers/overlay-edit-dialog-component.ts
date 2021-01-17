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
    private backupOverlay: Overlay;

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
        this.layerData = {
            ...layer,
            opacity: layer.opacity || 1.0
        };
        this.backupOverlay = layer;
    }

    public removeLayer() {
        this.layersService.removeOverlay(this.backupOverlay);
    }

    protected internalSave(layerData: LayerData): void {
        let overlay = {
            ...layerData,
            id: this.layerData.id,
            isEditable: true,
            visible: true
        } as Overlay;
        this.layersService.updateOverlay(this.backupOverlay, overlay);
    }
}
