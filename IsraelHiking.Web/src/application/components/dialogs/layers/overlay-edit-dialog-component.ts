import { Component } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers.service";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData, Overlay } from "../../../models/models";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    styleUrls: ["./layer-properties-dialog.component.scss"]
})
export class OverlayEditDialogComponent extends LayerBaseDialogComponent {
    private backupOverlay: Immutable<Overlay>;

    constructor(resources: ResourcesService,
                mapService: MapService,
                layersService: LayersService,
                toastService: ToastService,
                http: HttpClient,
                store: Store) {
        super(resources, mapService, layersService, toastService, http, store);
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
