import { HttpClient } from "@angular/common/http";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { BaseMapComponent } from "../../base-map.component";
import { LayerData, ApplicationState } from "../../../models/models";

export abstract class LayerBaseDialogComponent extends BaseMapComponent {
    public title: string;
    public key: string;
    public address: string;
    public minZoom: number;
    public maxZoom: number;
    public opacity: number;
    public isNew: boolean;
    public isOverlay: boolean;

    @select((state: ApplicationState) => state.location)
    public location;

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

    protected constructor(resources: ResourcesService,
        protected readonly mapService: MapService,
        protected readonly layersService: LayersService,
        protected readonly toastService: ToastService,
        private readonly http: HttpClient
    ) {
        super(resources);
        this.minZoom = LayersService.MIN_ZOOM;
        this.maxZoom = LayersService.MAX_NATIVE_ZOOM;
        this.key = "";
        this.address = "";
        this.opacity = 1.0;
    }

    public onAddressChanged(address: string) {
        this.address = address.trim();
        this.updateLayerKeyIfPossible();
    }

    public onOpacityChanged(opacity: number) {
        this.opacity = opacity;
    }

    public saveLayer = () => {
        let layerData = {
            key: this.key,
            address: this.getTilesAddress(),
            isEditable: true,
            minZoom: +this.minZoom, // fix issue with variable saved as string...
            maxZoom: +this.maxZoom,
            opacity: this.opacity
        } as LayerData;
        this.internalSave(layerData);
    }

    protected abstract internalSave(layerData: LayerData): void;

    public removeLayer(e: Event) { } // should be derived if needed.

    private getTilesAddress() {
        return decodeURI(this.address).replace("{zoom}", "{z}").trim();
    }

    private async updateLayerKeyIfPossible() {
        if (this.key) {
            return;
        }
        try {
            let address = `${this.getTilesAddress()}/?f=json`;
            address = address.replace("//?f", "/?f"); // in case the address the user set ends with "/".
            let response = await this.http.get(address).toPromise() as any;
            if (response && response.name) {
                this.key = response.name;
            }
        } catch (ex) {
            // ignore error
        }
    }
}