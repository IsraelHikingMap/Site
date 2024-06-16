import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData, EditableLayer } from "../../../models/models";

@Component({
    selector: "baselayer-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class BaseLayerEditDialogComponent extends LayerBaseDialogComponent {
    private backupBaseLayer: EditableLayer;

    constructor(resources: ResourcesService,
                mapService: MapService,
                layersService: LayersService,
                toastService: ToastService,
                http: HttpClient,
                store: Store) {
        super(resources, mapService, layersService, toastService, http, store);
        this.title = this.resources.baseLayerProperties;
        this.isNew = false;
        this.isOverlay = false;
    }

    public setBaseLayer(layer: EditableLayer) {
        this.layerData = { ...layer };
        this.backupBaseLayer = layer;
    }

    public removeLayer() {
        this.layersService.removeBaseLayer(this.backupBaseLayer);
    }

    protected internalSave(layerData: LayerData): void {
        const baseLayer = {
            ...layerData,
            id: this.backupBaseLayer.id,
            isEditable: true
        } as EditableLayer;
        this.layersService.updateBaseLayer(this.backupBaseLayer, baseLayer);
    }
}
