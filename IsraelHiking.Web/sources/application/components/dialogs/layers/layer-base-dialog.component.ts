import { AfterViewInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";
import * as L from "leaflet";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { MapLayersFactory } from "../../../services/map-layers.factory";
import { BaseMapComponent } from "../../base-map.component";
import { IApplicationState } from "../../../state/models/application-state";
import * as Common from "../../../common/IsraelHiking";

export abstract class LayerBaseDialogComponent extends BaseMapComponent implements AfterViewInit {
    public title: string;
    public key: string;
    public address: string;
    public minZoom: number;
    public maxZoom: number;
    public opacity: number;
    public isNew: boolean;
    public isOverlay: boolean;

    @select((state: IApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;;

    private mapPreview: L.Map;
    private previewLayer: L.Layer;

    protected constructor(resources: ResourcesService,
        protected readonly mapService: MapService,
        protected readonly layersService: LayersService,
        protected readonly toastService: ToastService,
        private readonly http: HttpClient
    ) {
        super(resources);
        this.minZoom = MapLayersFactory.MIN_ZOOM;
        this.maxZoom = MapLayersFactory.MAX_NATIVE_ZOOM;
        this.key = "";
        this.address = "";
        this.opacity = 1.0;

        this.previewLayer = null;
    }

    public ngAfterViewInit(): void {
        this.mapPreview = L.map("mapPreview",
            {
                center: this.mapService.map.getCenter(),
                zoomControl: false,
                minZoom: +this.minZoom,
                maxZoom: +this.maxZoom,
                zoom: (+this.maxZoom + +this.minZoom) / 2
            });
        this.refreshPreviewLayer();
    }

    public onAddressChanged(address: string) {
        this.address = address.trim();
        this.refreshPreviewLayer();
        this.updateLayerKeyIfPossible();
    }

    public onOpacityChanged(opacity: number) {
        this.opacity = opacity;
        this.refreshPreviewLayer();
    }

    protected refreshPreviewLayer() {
        if (this.previewLayer != null) {
            this.mapPreview.removeLayer(this.previewLayer);
        }
        this.previewLayer = MapLayersFactory.createLayer({
            address: this.getTilesAddress(),
            opacity: this.opacity
        } as Common.LayerData);
        this.mapPreview.addLayer(this.previewLayer);
    }

    public saveLayer = (e: Event) => {
        let layerData = {
            key: this.key,
            address: this.getTilesAddress(),
            isEditable: true,
            minZoom: +this.minZoom, // fix issue with variable saved as string...
            maxZoom: +this.maxZoom,
            opacity: this.opacity
        } as Common.LayerData;
        this.internalSave(layerData);
        this.suppressEvents(e);
    }

    protected abstract internalSave(layerData: Common.LayerData): void;

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
            address = address.replace("//?f", "/?f"); // incase the address the user set ends with "/".
            let response = await this.http.get(address).toPromise() as any;
            if (response && response.name) {
                this.key = response.name;
            }
        } catch (ex) {
            // ignore error
        }
    }
}