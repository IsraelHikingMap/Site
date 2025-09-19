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
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Angulartics2OnModule } from "angulartics2";

import { AutomaticLayerPresentationComponent } from "../../map/automatic-layer-presentation.component";
import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { LayerBaseDialogComponent } from "./layer-base-dialog.component";
import type { LayerData } from "../../../models";

@Component({
    selector: "overlay-add-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    styleUrls: ["./layer-properties-dialog.component.scss"],
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, NameInUseValidatorDirective, MatError, MatSlider, MatSliderThumb, MapComponent, AutomaticLayerPresentationComponent, MatDialogActions, Angulartics2OnModule, MatTooltip, AsyncPipe]
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
