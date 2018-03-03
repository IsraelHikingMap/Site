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
    private layer: IBaseLayer;

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
        this.layer = layer;
        this.key = this.layer.key;
        this.maxZoom = this.layer.maxZoom;
        this.minZoom = this.layer.minZoom;
        this.address = this.layer.address;
    }

    public removeLayer(e: Event) {
        this.layersService.removeBaseLayer(this.layer);
        this.suppressEvents(e);
    }

    protected internalSave(layerData: Common.LayerData): void {
        this.layersService.updateBaseLayer(this.layer, layerData);
    }
}