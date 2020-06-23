import { HttpClient } from "@angular/common/http";
import { select } from "@angular-redux/store";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { BaseMapComponent } from "../../base-map.component";
import { LayerData, ApplicationState, EditableLayer } from "../../../models/models";

export abstract class LayerBaseDialogComponent extends BaseMapComponent {
    public title: string;
    public isNew: boolean;
    public isOverlay: boolean;

    public layerData: EditableLayer;

    @select((state: ApplicationState) => state.location)
    public location;

    protected constructor(resources: ResourcesService,
                          protected readonly mapService: MapService,
                          protected readonly layersService: LayersService,
                          protected readonly toastService: ToastService,
                          private readonly http: HttpClient
    ) {
        super(resources);
        this.layerData = {
            minZoom: LayersService.MIN_ZOOM,
            maxZoom: LayersService.MAX_NATIVE_ZOOM,
            key: "",
            address: "",
            opacity: 1.0,
            isEditable: true,
            isOfflineAvailable: false,
            isOfflineOn: true
        } as EditableLayer;
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

    public saveLayer = () => {
        let layerData = {
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
            let response = await this.http.get(address).toPromise() as { name: string };
            if (response && response.name) {
                this.layerData.key = response.name;
            }
        } catch (ex) {
            // ignore error
        }
    }
}
