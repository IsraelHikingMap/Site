import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService, IOverlay } from "../../../services/layers/LayersService";
import { LayerBaseDialogComponent } from "./LayerBaseDialogComponent";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layerPropertiesDialog.html"
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
    }

    public removeLayer = (e: Event) => {
        this.layersService.removeOverlay(this.layer);
        this.suppressEvents(e);
    }

    protected internalSave(layerData: Common.LayerData) {
        return this.layersService.updateOverlay(this.layer, layerData);
    }
}