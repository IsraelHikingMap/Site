import { AfterViewInit } from "@angular/core";

import { ResourcesService } from "../../../services/resources.service";
import { MapService } from "../../../services/map.service";
import { ToastService } from "../../../services/toast.service";
import { LayersService } from "../../../services/layers/layers.service";
import { BaseMapComponent } from "../../base-map.component";
import * as Common from "../../../common/IsraelHiking";

export abstract class LayerBaseDialogComponent extends BaseMapComponent implements AfterViewInit {
    public title: string;
    public key: string;
    public address: string;
    public minZoom: number;
    public maxZoom: number;
    public isNew: boolean;

    private mapPreview: L.Map;
    private tileLayer: L.TileLayer;
    
    protected constructor(resources: ResourcesService,
        protected mapService: MapService,
        protected layersService: LayersService,
        protected toastService: ToastService
    ) {
        super(resources);
        this.minZoom = LayersService.MIN_ZOOM;
        this.maxZoom = LayersService.MAX_NATIVE_ZOOM;
        this.key = "";
        this.address = "";

        this.tileLayer = null;
    }

    ngAfterViewInit(): void {
        this.mapPreview = L.map("mapPreview",
            {
                center: this.mapService.map.getCenter(),
                zoomControl: false,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                zoom: (this.maxZoom + this.minZoom) / 2
            });
        this.tileLayer = L.tileLayer(this.getTilesAddress());
        this.mapPreview.addLayer(this.tileLayer);
    }

    public addressChanged(address: string) {
        this.address = address;
        this.mapPreview.removeLayer(this.tileLayer);
        this.tileLayer = L.tileLayer(this.getTilesAddress());
        this.mapPreview.addLayer(this.tileLayer);
    }

    public saveLayer = (e: Event) => {
        var layerData = {
            key: this.key,
            address: this.getTilesAddress(),
            isEditable: true,
            minZoom: this.minZoom,
            maxZoom: this.maxZoom
        } as Common.LayerData;
        var message = this.internalSave(layerData);
        if (message !== "") {
            this.toastService.error(message);
        }
        this.suppressEvents(e);
    }

    protected abstract internalSave(layerData: Common.LayerData): string;

    public removeLayer(e: Event) { } // should be derived if needed.

    private getTilesAddress() {
        return decodeURI(this.address).replace("{zoom}", "{z}");
    }
}