import { Component, inject } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions, MAT_DIALOG_DATA } from "@angular/material/dialog";
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
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import type { Immutable } from "immer";

import { AutomaticLayerPresentationComponent } from "../../map/automatic-layer-presentation.component";
import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData, Overlay } from "../../../models";

@Component({
    selector: "overlay-edit-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    styleUrls: ["./layer-properties-dialog.component.scss"],
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, NameInUseValidatorDirective, MatError, MatSlider, MatSliderThumb, MapComponent, AutomaticLayerPresentationComponent, MatDialogActions, Angulartics2OnModule, MatTooltip, AsyncPipe, CdkCopyToClipboard]
})
export class OverlayEditDialogComponent extends LayerBaseDialogComponent {
    private backupOverlay: Immutable<Overlay>;

    private readonly data = inject<Immutable<Overlay>>(MAT_DIALOG_DATA);

    constructor() {
        super();
        this.title = this.resources.overlayProperties;
        this.isNew = false;
        this.isOverlay = true;
        this.layerData = {
            ...this.data,
            opacity: this.data.opacity || 1.0
        };
        this.backupOverlay = this.data;
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
