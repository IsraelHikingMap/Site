import { Component } from "@angular/core";
import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService } from "../../../services/layers/LayersService";
import { LayerBaseDialogComponent } from "./LayerBaseDialogComponent";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "overlay-add-dialog",
    moduleId: module.id,
    templateUrl: "layerPropertiesDialog.html"
})
export class OverlayAddDialogComponent extends LayerBaseDialogComponent {
    constructor(resources: ResourcesService,
        mapService: MapService,
        layersService: LayersService,
        toastService: ToastService) {
        super(resources, mapService, layersService, toastService);
        this.title = this.resources.addOverlay;
        this.isNew = true;
    }

    protected internalSave(layerData: Common.LayerData) {
        var overlay = this.layersService.addOverlay(layerData);
        this.layersService.toggleOverlay(overlay);
        return "";
    }
}