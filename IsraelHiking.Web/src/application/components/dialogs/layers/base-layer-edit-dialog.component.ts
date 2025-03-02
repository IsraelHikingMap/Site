import { Component } from "@angular/core";

import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData, EditableLayer } from "../../../models/models";

@Component({
    selector: "baselayer-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    standalone: false
})
export class BaseLayerEditDialogComponent extends LayerBaseDialogComponent {
    private backupBaseLayer: EditableLayer;

    constructor() {
        super();
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
