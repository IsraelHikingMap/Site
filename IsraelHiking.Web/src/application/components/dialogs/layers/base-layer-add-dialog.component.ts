import { Component } from "@angular/core";

import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData } from "../../../models/models";

@Component({
    selector: "baselayer-add-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    standalone: false
})
export class BaseLayerAddDialogComponent extends LayerBaseDialogComponent {
    constructor() {
        super();
        this.title = this.resources.addBaseLayer;
        this.isNew = true;
        this.isOverlay = false;
    }

    protected internalSave(layerData: LayerData): void {
        this.layersService.addBaseLayer(layerData);
    }
}
