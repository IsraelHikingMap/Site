import { Component } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { MatButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatFormField, MatLabel, MatError } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { AsyncPipe } from "@angular/common";
import { MatSlider, MatSliderThumb } from "@angular/material/slider";
import { MatTooltip } from "@angular/material/tooltip";
import { Angulartics2OnModule } from "angulartics2";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";

import { AutomaticLayerPresentationComponent } from "../../map/automatic-layer-presentation.component";
import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData, EditableLayer } from "../../../models";

@Component({
    selector: "baselayer-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, NameInUseValidatorDirective, MatError, MatSlider, MatSliderThumb, MapComponent, AutomaticLayerPresentationComponent, MatDialogActions, Angulartics2OnModule, MatTooltip, AsyncPipe]
})
export class BaseLayerEditDialogComponent extends LayerBaseDialogComponent {
    private backupBaseLayer: EditableLayer;

    constructor() {
        super();
        this.title = this.resources.baseLayerProperties;
        this.isNew = false;
        this.isOverlay = false;
    }

    public setBaseLayer(layer: EditableLayer) {
        this.layerData = { ...layer };
        this.backupBaseLayer = layer;
    }

    public removeLayer() {
        this.layersService.removeBaseLayer(this.backupBaseLayer);
    }

    protected internalSave(layerData: LayerData): void {
        const baseLayer = {
            ...layerData,
            id: this.backupBaseLayer.id,
            isEditable: true
        } as EditableLayer;
        this.layersService.updateBaseLayer(this.backupBaseLayer, baseLayer);
    }
}
