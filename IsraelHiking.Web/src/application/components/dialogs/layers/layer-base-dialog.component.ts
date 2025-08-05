import { HttpClient } from "@angular/common/http";
import { Observable, firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers.service";
import type { LayerData, ApplicationState, EditableLayer, LocationState } from "../../../models/models";
import type { Immutable } from "immer";
import { inject } from "@angular/core";

export abstract class LayerBaseDialogComponent {
    public title: string;
    public isNew: boolean;
    public isOverlay: boolean;
    public layerData: EditableLayer;
    public location$: Observable<Immutable<LocationState>>;

    public readonly resources = inject(ResourcesService);

    protected readonly mapService = inject(MapService);
    protected readonly layersService = inject(LayersService);
    protected readonly toastService = inject(ToastService);
    private readonly http = inject(HttpClient);
    private readonly store = inject(Store);

    protected constructor() {
        this.layerData = {
            minZoom: LayersService.MIN_ZOOM,
            maxZoom: LayersService.MAX_NATIVE_ZOOM,
            key: "",
            address: "",
            opacity: 1.0,
            isEditable: true,
            isOfflineAvailable: false
        } as EditableLayer;
        
        this.location$ = this.store.select((state: ApplicationState) => state.locationState);
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

    protected abstract internalSave(layerData: LayerData): void;

    public removeLayer() { } // should be derived if needed.

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
}
