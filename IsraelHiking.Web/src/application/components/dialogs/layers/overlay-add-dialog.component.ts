import { Component } from "@angular/core";

import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData } from "../../../models/models";

@Component({
    selector: "overlay-add-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    styleUrls: ["./layer-properties-dialog.component.scss"],
    standalone: false
})
export class OverlayAddDialogComponent extends LayerBaseDialogComponent {
    constructor() {
        super();
        this.title = this.resources.addOverlay;
        this.isNew = true;
        this.isOverlay = true;
    }

    protected internalSave(layerData: LayerData): void {
        this.layersService.addOverlay(layerData);
    }
}
