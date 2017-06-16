import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService, IBaseLayer } from "../../../services/layers/LayersService";
import { LayerBaseDialogComponent } from "./LayerBaseDialogComponent";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "baselayer-edit-dialog",
    templateUrl: "./layerPropertiesDialog.html"
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

    protected internalSave(layerData: Common.LayerData) {
        return this.layersService.updateBaseLayer(this.layer, layerData);
    }
}