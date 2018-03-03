import { AfterViewInit } from "@angular/core";
import * as L from "leaflet";

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
    public opacity: number;
    public isNew: boolean;
    public isAdvanced: boolean;
    public isOverlay: boolean;
    
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
        this.opacity = 1.0;

        this.tileLayer = null;
    }

    ngAfterViewInit(): void {
        this.mapPreview = L.map("mapPreview",
            {
                center: this.mapService.map.getCenter(),
                zoomControl: false,
                minZoom: this.minZoom,
                maxZoom: this.maxZoom,
                zoom: (parseInt(this.maxZoom as any) + parseInt(this.minZoom as any)) / 2
            });
        this.tileLayer = L.tileLayer(this.getTilesAddress());
        this.mapPreview.addLayer(this.tileLayer);
    }

    public onAddressChanged(address: string) {
        this.address = address.trim();
        this.refreshPreviewLayer();
    }

    public onOpacityChanged(opacity: number) {
        this.opacity = opacity;
        this.refreshPreviewLayer();
    }

    protected refreshPreviewLayer() {
        this.mapPreview.removeLayer(this.tileLayer);
        this.tileLayer = L.tileLayer(this.getTilesAddress(), { opacity: this.opacity });
        this.mapPreview.addLayer(this.tileLayer);
    }

    public saveLayer = (e: Event) => {
        var layerData = {
            key: this.key,
            address: this.getTilesAddress(),
            isEditable: true,
            minZoom: parseInt(this.minZoom as any), // fix issue with variable saved as string...
            maxZoom: parseInt(this.maxZoom as any),
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
}