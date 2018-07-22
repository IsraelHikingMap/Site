import { AfterViewInit } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import * as L from "leaflet";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { MapLayersFactory } from "../../../services/map-layers.factory";
import { BaseMapComponent } from "../../base-map.component";
import * as Common from "../../../common/IsraelHiking";

export abstract class LayerBaseDialogComponent extends BaseMapComponent implements AfterViewInit {
    public title: string;
    public key: string;
    public address: string;
    public minZoom: number;
    public maxZoom: number;
    public opacity: number;
    public isNew: boolean;
    public isAdvanced: boolean;
    public isOverlay: boolean;

    private mapPreview: L.Map;
    private layer: L.Layer;

    protected constructor(resources: ResourcesService,
        protected mapService: MapService,
        protected layersService: LayersService,
        protected toastService: ToastService,
        private http: HttpClient
    ) {
        super(resources);
        this.minZoom = MapLayersFactory.MIN_ZOOM;
        this.maxZoom = MapLayersFactory.MAX_NATIVE_ZOOM;
        this.key = "";
        this.address = "";
        this.opacity = 1.0;

        this.layer = null;
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
        this.layer = MapLayersFactory.createLayer({ address: this.getTilesAddress() } as Common.LayerData);
        this.mapPreview.addLayer(this.layer);
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
        this.mapPreview.removeLayer(this.layer);
        this.layer = MapLayersFactory.createLayer({ address: this.getTilesAddress() } as Common.LayerData);
        this.mapPreview.addLayer(this.layer);
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

    public setIsAdvanced(isAdvanced: boolean) {
        this.isAdvanced = isAdvanced;
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