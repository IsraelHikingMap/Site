import { Component, computed, DestroyRef, inject, input, linkedSignal, output } from "@angular/core";
import { takeUntilDestroyed } from "@angular/core/rxjs-interop";
import { MatExpansionPanel } from "@angular/material/expansion";
import { MatButton } from "@angular/material/button";
import { MatFormField, MatLabel, MatError } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { MatSlider, MatSliderThumb } from "@angular/material/slider";
import { HttpClient } from "@angular/common/http";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { AutomaticLayerPresentationComponent } from "../../map/automatic-layer-presentation.component";
import { NameInUseValidatorDirective } from "../../../directives/name-in-use-validator.directive";
import { AnalyticsDirective } from "../../../directives/analytics.directive";
import { ResourcesService } from "../../../services/resources.service";
import { LayersService } from "../../../services/layers.service";
import type { ApplicationState, EditableLayer } from "../../../models";

/**
 * The form that adds or edits a custom layer, inside an expansion panel of the manage layers dialog. Edits have no
 * save button: they are stored when the panel or the dialog closes, and dropped if the name is taken or missing -
 * not as they are typed, since a rename changes the layer's key and is sent to the server. A new layer is only
 * added by its add button, so a form left half filled does not become a layer.
 */
@Component({
    selector: "layer-properties",
    templateUrl: "./layer-properties.component.html",
    imports: [MatButton, MatFormField, MatLabel, MatInput, FormsModule, NameInUseValidatorDirective, MatError, MatSlider, MatSliderThumb, MapComponent, AutomaticLayerPresentationComponent, AnalyticsDirective]
})
export class LayerPropertiesComponent {
    /** The layer to edit, or null to add a new one. */
    public readonly layer = input<Immutable<EditableLayer>>(null);
    public readonly isOverlay = input.required<boolean>();
    /** Emitted once a new layer was added. */
    public readonly added = output<void>();

    public readonly isNew = computed(() => this.layer() == null);
    public readonly layerData = linkedSignal<EditableLayer>(() => this.layer() == null
        ? { minZoom: 1, maxZoom: 16, key: "", address: "", opacity: 1.0, isEditable: true } as EditableLayer
        : { ...this.layer(), opacity: this.layer().opacity || 1.0 } as EditableLayer);

    public readonly resources = inject(ResourcesService);

    private readonly layersService = inject(LayersService);
    private readonly http = inject(HttpClient);
    private readonly store = inject(Store);

    public readonly location = this.store.selectSignal((state: ApplicationState) => state.locationState);

    private isChanged = false;

    constructor() {
        inject(MatExpansionPanel).closed.pipe(takeUntilDestroyed()).subscribe(() => this.storeChanges());
        inject(DestroyRef).onDestroy(() => this.storeChanges());
    }

    public onAddressChanged(address: string) {
        this.isChanged = true;
        this.layerData.update(layerData => ({
            ...layerData,
            address: decodeURI(address).replace("{zoom}", "{z}").trim()
        }));
        this.updateLayerKeyIfPossible();
    }

    public onOpacityChanged(opacity: number) {
        this.isChanged = true;
        this.layerData.update(layerData => ({ ...layerData, opacity }));
    }

    public onKeyChanged(key: string) {
        this.isChanged = true;
        this.layerData.update(layerData => ({ ...layerData, key }));
    }

    public onMinZoomChanged(minZoom: number) {
        this.isChanged = true;
        this.layerData.update(layerData => ({ ...layerData, minZoom }));
    }

    public onMaxZoomChanged(maxZoom: number) {
        this.isChanged = true;
        this.layerData.update(layerData => ({ ...layerData, maxZoom }));
    }

    /**
     * Number inputs hand back strings once edited, so the zoom levels are converted before they are stored. An edited
     * layer that is no longer in the store was deleted while its panel was open.
     */
    private storeChanges() {
        const layerData = { ...this.layerData(), minZoom: +this.layerData().minZoom, maxZoom: +this.layerData().maxZoom } as EditableLayer;
        const original = this.layer() as EditableLayer;
        if (this.isNew() || !this.isChanged || !this.isValid(layerData, original)) {
            return;
        }
        this.isChanged = false;
        if (this.isOverlay()) {
            this.layersService.updateOverlay(original, { ...layerData, id: original.id, isEditable: true });
        } else {
            this.layersService.updateBaseLayer(original, { ...layerData, id: original.id, isEditable: true });
        }
    }

    public add() {
        const layerData = { ...this.layerData(), minZoom: +this.layerData().minZoom, maxZoom: +this.layerData().maxZoom } as EditableLayer;
        if (this.isOverlay()) {
            this.layersService.addOverlay(layerData);
        } else {
            this.layersService.addBaseLayer(layerData);
        }
        this.added.emit();
    }

    public canAdd(): boolean {
        return this.isValid(this.layerData(), null);
    }

    private isValid(layerData: EditableLayer, original: EditableLayer): boolean {
        if (!layerData.key || !layerData.address) {
            return false;
        }
        const layersState = this.store.selectSnapshot((state: ApplicationState) => state.layersState);
        const layers = this.isOverlay() ? layersState.overlays : layersState.baseLayers;
        if (original != null && !layers.some(l => l.key === original.key)) {
            return false;
        }
        return original?.key === layerData.key || this.layersService.isNameAvailable(original?.key, layerData.key, this.isOverlay());
    }

    /**
     * Fills in an empty name from the server's own name for the layer, which an ArcGIS style address returns
     * when asked for json. Most addresses do not support it, so a failure is expected and ignored.
     */
    private async updateLayerKeyIfPossible() {
        if (this.layerData().key) {
            return;
        }
        try {
            const address = `${this.layerData().address}/?f=json`.replace("//?f", "/?f");
            const response = await firstValueFrom(this.http.get(address)) as { name: string };
            if (response && response.name) {
                this.layerData.update(layerData => ({ ...layerData, key: response.name }));
            }
        } catch {
            return;
        }
    }
}
