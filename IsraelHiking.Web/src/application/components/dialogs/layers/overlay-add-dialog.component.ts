import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData } from "../../../models/models";

@Component({
    selector: "overlay-add-dialog",
    templateUrl: "./layer-properties-dialog.component.html"
})
export class OverlayAddDialogComponent extends LayerBaseDialogComponent {
    constructor(resources: ResourcesService,
                mapService: MapService,
                layersService: LayersService,
                toastService: ToastService,
                http: HttpClient) {
        super(resources, mapService, layersService, toastService, http);
        this.title = this.resources.addOverlay;
        this.isNew = true;
        this.isOverlay = true;
    }

    protected internalSave(layerData: LayerData): void {
        let overlay = this.layersService.addOverlay(layerData);
        this.layersService.toggleOverlay(overlay);
    }
}
