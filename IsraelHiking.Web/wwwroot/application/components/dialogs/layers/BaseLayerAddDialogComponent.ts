import { Component } from "@angular/core";
import { LayerBaseDialogComponent } from "./LayerBaseDialogComponent";
import { ResourcesService } from "../../../services/ResourcesService";
import { MapService } from "../../../services/MapService";
import { ToastService } from "../../../services/ToastService";
import { LayersService } from "../../../services/layers/LayersService";
import * as Common from "../../../common/IsraelHiking";

@Component({
    selector: "baselayer-add-dialog",
    moduleId: module.id,
    templateUrl: "layerPropertiesDialog.html"
})
export class BaseLayerAddDialogComponent extends LayerBaseDialogComponent {
    constructor(resources: ResourcesService,
        layersService: LayersService,
        mapService: MapService,
        toastService: ToastService,
        ) {
        super(resources, mapService, layersService, toastService);
        this.title = this.resources.addBaseLayer;
        this.isNew = true;
    }

    protected internalSave(layerData: Common.LayerData): string {
        let layer = this.layersService.addBaseLayer(layerData);
        this.layersService.selectBaseLayer(layer);
        return "";
    };
}