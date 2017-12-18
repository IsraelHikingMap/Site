import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService, IOverlay } from "../../../services/layers/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class OverlayEditDialogComponent extends LayerBaseDialogComponent {
    private layer: IOverlay;

    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        toastService: ToastService) {
        super(resources, mapService, layersService, toastService);
        this.title = this.resources.overlayProperties;
        this.isNew = false;
    }

    public setOverlay(layer: IOverlay) {
        this.layer = layer;
        this.key = this.layer.key;
        this.maxZoom = this.layer.maxZoom;
        this.minZoom = this.layer.minZoom;
        this.address = this.layer.address;
        this.opacity = this.layer.opacity || 1.0;
    }

    public removeLayer(e: Event) {
        this.layersService.removeOverlay(this.layer);
        this.suppressEvents(e);
    }

    protected internalSave(layerData: Common.LayerData) {
        return this.layersService.updateOverlay(this.layer, layerData);
    }
}