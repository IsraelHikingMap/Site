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
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { HttpClient } from "@angular/common/http";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Observable, firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { Share } from "@capacitor/share";
import type { Immutable } from "immer";

import { AutomaticLayerPresentationComponent } from "../../map/automatic-layer-presentation.component";
import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { ResourcesService } from "../../../services/resources.service";
import { LayersService } from "../../../services/layers.service";
import { RunningContextService } from "../../../services/running-context.service";
import type { LayerData, ApplicationState, EditableLayer, LocationState, Overlay } from "../../../models";

export type LayerPropertiesDialogType = "addOverlay" | "addBaseLayer" | "editOverlay" | "editBaseLayer";

export type LayerPropertiesDialogComponentData = {
    dialogType: LayerPropertiesDialogType;
    layerData: Immutable<EditableLayer>;
};

@Component({
    selector: "layer-dialog",
    templateUrl: "./layer-properties-dialog.component.html",
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, NameInUseValidatorDirective, MatError, MatSlider, MatSliderThumb, MapComponent, AutomaticLayerPresentationComponent, MatDialogActions, Angulartics2OnModule, MatTooltip, AsyncPipe, CdkCopyToClipboard]
})
export class LayerPropertiesDialogComponent {
    public title: string;
    public isNew: boolean;
    public isApp: boolean;
    public isOverlay: boolean;
    public layerData: EditableLayer;
    public location$: Observable<Immutable<LocationState>>;

    public readonly resources = inject(ResourcesService);

    private readonly layersService = inject(LayersService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly http = inject(HttpClient);
    private readonly store = inject(Store);

    private backupLayer: EditableLayer;
    private readonly data = inject<LayerPropertiesDialogComponentData>(MAT_DIALOG_DATA);

    constructor() {
        this.layerData = {
            minZoom: 1,
            maxZoom: 16,
            key: "",
            address: "",
            opacity: 1.0,
            isEditable: true,
        } as EditableLayer;

        this.location$ = this.store.select((state: ApplicationState) => state.locationState);
        this.isApp = this.runningContextService.isCapacitor;

        switch (this.data.dialogType) {
            case "addBaseLayer":
                this.title = this.resources.addBaseLayer;
                this.isNew = true;
                this.isOverlay = false;
                break;
            case "editBaseLayer":
                this.title = this.resources.baseLayerProperties;
                this.isNew = false;
                this.isOverlay = false;
                this.layerData = { ...this.data.layerData };
                this.backupLayer = this.data.layerData;
                break;
            case "addOverlay":
                this.title = this.resources.addOverlay;
                this.isNew = true;
                this.isOverlay = true;
                break;
            case "editOverlay":
                this.title = this.resources.overlayProperties;
                this.isNew = false;
                this.isOverlay = true;
                this.layerData = {
                    ...this.data.layerData,
                    opacity: this.data.layerData.opacity || 1.0
                };
                this.backupLayer = this.data.layerData;
                break;
        }
    }

    public onAddressChanged(address: string) {
        // in order to cuase changes in child component
        this.layerData = {
            ...this.layerData,
            address: decodeURI(address).replace("{zoom}", "{z}").trim()
        };
        this.updateLayerKeyIfPossible();
    }

    public onOpacityChanged(opacity: number) {
        this.layerData.opacity = opacity;
    }

    public saveLayer() {
        const layerData = {
            ...this.layerData,
            minZoom: +this.layerData.minZoom, // fix issue with variable saved as string...
            maxZoom: +this.layerData.maxZoom,
        } as LayerData;
        this.internalSave(layerData);
    }

    private internalSave(layerData: LayerData) {
        switch (this.data.dialogType) {
            case "addBaseLayer":
                this.layersService.addBaseLayer(layerData);
                break;
            case "editBaseLayer":
                const baseLayer = {
                    ...layerData,
                    id: this.backupLayer.id,
                    isEditable: true
                } as EditableLayer;
                this.layersService.updateBaseLayer(this.backupLayer, baseLayer);
                break;
            case "addOverlay":
                this.layersService.addOverlay(layerData);
                break;
            case "editOverlay":
                const overlay = {
                    ...layerData,
                    id: this.layerData.id,
                    isEditable: true,
                    visible: true
                } as Overlay;
                this.layersService.updateOverlay(this.backupLayer as Overlay, overlay);
                break;
        }
    }

    public removeLayer() {
        switch (this.data.dialogType) {
            case "addBaseLayer":
                break;
            case "editBaseLayer":
                this.layersService.removeBaseLayer(this.backupLayer);
                break;
            case "addOverlay":
                break;
            case "editOverlay":
                this.layersService.removeOverlay(this.backupLayer as Overlay);
                break;
        }
    }

    private async updateLayerKeyIfPossible() {
        if (this.layerData.key) {
            return;
        }
        try {
            let address = `${this.layerData.address}/?f=json`;
            address = address.replace("//?f", "/?f"); // in case the address the user set ends with "/".
            const response = await firstValueFrom(this.http.get(address)) as { name: string };
            if (response && response.name) {
                this.layerData.key = response.name;
            }
        } catch {
            // ignore error
        }
    }

    public shareLayer() {
        Share.share({ url: this.getShareLayerAddress() });
    }

    public getShareLayerAddress() {
        return this.layersService.layerDataToAddress(this.layerData, this.isOverlay);
    }
}
