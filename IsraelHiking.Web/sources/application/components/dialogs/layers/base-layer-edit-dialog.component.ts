import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import { LayerData, EditableLayer } from "../../../models/models";

@Component({
    selector: "baselayer-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class BaseLayerEditDialogComponent extends LayerBaseDialogComponent {
    private baseLayer: EditableLayer;

    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        toastService: ToastService,
        http: HttpClient) {
        super(resources, mapService, layersService, toastService, http);
        this.title = this.resources.baseLayerProperties;
        this.isNew = false;
        this.isOverlay = false;
    }

    public setBaseLayer(layer: EditableLayer) {
        this.baseLayer = layer;
        this.key = this.baseLayer.key;
        this.maxZoom = this.baseLayer.maxZoom;
        this.minZoom = this.baseLayer.minZoom;
        this.address = this.baseLayer.address;
    }

    public removeLayer() {
        this.layersService.removeBaseLayer(this.baseLayer);
    }

    protected internalSave(layerData: LayerData): void {
        let baseLayer = {
            ...layerData,
            id: this.baseLayer.id,
            isEditable: true
        } as EditableLayer;
        this.layersService.updateBaseLayer(this.baseLayer, baseLayer);
    }
}