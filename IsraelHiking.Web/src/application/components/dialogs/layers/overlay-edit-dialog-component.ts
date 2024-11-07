import { Component } from "@angular/core";
import type { Immutable } from "immer";

import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData, Overlay } from "../../../models/models";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    styleUrls: ["./layer-properties-dialog.component.scss"]
})
export class OverlayEditDialogComponent extends LayerBaseDialogComponent {
    private backupOverlay: Immutable<Overlay>;

    constructor() {
        super();
        this.title = this.resources.overlayProperties;
        this.isNew = false;
        this.isOverlay = true;
    }

    public setOverlay(layer: Immutable<Overlay>) {
        this.layerData = {
            ...layer,
            opacity: layer.opacity || 1.0
        };
        this.backupOverlay = layer;
    }

    public removeLayer() {
        this.layersService.removeOverlay(this.backupOverlay);
    }

    protected internalSave(layerData: LayerData): void {
        const overlay = {
            ...layerData,
            id: this.layerData.id,
            isEditable: true,
            visible: true
        } as Overlay;
        this.layersService.updateOverlay(this.backupOverlay, overlay);
    }
}
