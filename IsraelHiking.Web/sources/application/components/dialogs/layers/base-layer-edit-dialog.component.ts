import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService, IBaseLayer } from "../../../services/layers/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "baselayer-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class BaseLayerEditDialogComponent extends LayerBaseDialogComponent {
    private baseLayer: IBaseLayer;

    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        toastService: ToastService) {
        super(resources, mapService, layersService, toastService);
        this.title = this.resources.baseLayerProperties;
        this.isNew = false;
        this.isOverlay = false;
    }

    public setBaseLayer(layer: IBaseLayer) {
        this.baseLayer = layer;
        this.key = this.baseLayer.key;
        this.maxZoom = this.baseLayer.maxZoom;
        this.minZoom = this.baseLayer.minZoom;
        this.address = this.baseLayer.address;
    }

    public removeLayer(e: Event) {
        this.layersService.removeBaseLayer(this.baseLayer);
        this.suppressEvents(e);
    }

    protected internalSave(layerData: Common.LayerData): void {
        this.layersService.updateBaseLayer(this.baseLayer, layerData);
    }
}