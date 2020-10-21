import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from "@angular/core";
import { MapComponent } from "ngx-mapbox-gl";
import { RasterSource, RasterLayout, Layer, Style, Sources } from "mapbox-gl";
import { Subscription } from "rxjs";

import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { BaseMapComponent } from "../base-map.component";
import { ConnectionService } from "../../services/connection.service";
import { NgRedux } from "@angular-redux/store";
import { ApplicationState, EditableLayer } from "../../models/models";

@Component({
    selector: "auto-layer",
    templateUrl: "./automatic-layer-presentation.component.html"
})
export class AutomaticLayerPresentationComponent extends BaseMapComponent implements OnInit, OnChanges, OnDestroy {
    private static indexNumber = 0;

    private static readonly ATTRIBUTION = "<a href='https://github.com/IsraelHikingMap/Site/wiki/Attribution' target='_blank'>" +
        "Click me to see attribution</a>";

    @Input()
    public visible: boolean;
    @Input()
    public before: string;
    @Input()
    public isBaselayer: boolean;
    @Input()
    public layerData: EditableLayer;

    private rasterSourceId;
    private rasterLayerId;
    private sourceAdded: boolean;
    private subscriptions: Subscription[];
    private jsonSourcesIds: string[];
    private jsonLayersIds: string[];
    private hasInternetAccess: boolean;

    constructor(resources: ResourcesService,
                private readonly host: MapComponent,
                private readonly fileService: FileService,
                private readonly connectionSerive: ConnectionService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
        let layerIndex = AutomaticLayerPresentationComponent.indexNumber++;
        this.rasterLayerId = `raster-layer-${layerIndex}`;
        this.rasterSourceId = `raster-source-${layerIndex}`;
        this.sourceAdded = false;
        this.hasInternetAccess = true;
        this.jsonSourcesIds = [];
        this.jsonLayersIds = [];
        this.subscriptions = [];
    }

    public async ngOnInit() {
        if (this.host.mapInstance == null) {
            this.subscriptions.push(this.host.load.subscribe(async () => {
                await this.createLayer();
                this.sourceAdded = true;
            }));
        } else {
            await this.createLayer();
            this.sourceAdded = true;
        }
        this.subscriptions.push(this.resources.languageChanged.subscribe(async () => {
            if (this.sourceAdded) {
                this.removeLayer(this.layerData.address);
                await this.createLayer();
            }
        }));
        this.subscriptions.push(this.connectionSerive.monitor(true).subscribe(async (state) => {
            if (this.ngRedux.getState().offlineState.lastModifiedDate == null || this.layerData.isOfflineAvailable === false) {
                return;
            }
            if (state.hasInternetAccess === this.hasInternetAccess) {
                return;
            }
            if (this.layerData.isOfflineOn === true) {
                return;
            }
            this.hasInternetAccess = state.hasInternetAccess;
            if (this.sourceAdded) {
                this.removeLayer(this.layerData.address);
                await this.createLayer();
            }
        }));
    }

    public ngOnDestroy() {
        for (let subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
        if (this.sourceAdded) {
            this.removeLayer(this.layerData.address);
            this.sourceAdded = false;
        }
    }

    async ngOnChanges(changes: SimpleChanges) {
        if (this.sourceAdded) {
            let addressToRemove = changes.layerData ? changes.layerData.previousValue.address : this.layerData.address;
            this.removeLayer(addressToRemove);
            await this.createLayer();
        }
    }

    private isRaster(address: string) {
        return !address.endsWith("json");
    }

    private createRasterLayer() {
        let address = this.layerData.address;
        let scheme = "xyz";
        if (this.layerData.address.match(/\/MapServer(\/\d+)?$/i) != null) {
            address += "/export?dpi=96&transparent=true&format=png32&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image";
        } else if (this.layerData.address.indexOf("{-y}") !== -1) {
            address = address.replace("{-y}", "{y}");
            scheme = "tms";
        }
        let source = {
            type: "raster",
            tiles: [address],
            minzoom: Math.max(this.layerData.minZoom - 1, 0),
            maxzoom: this.layerData.maxZoom,
            scheme,
            tileSize: 256,
            attribution: AutomaticLayerPresentationComponent.ATTRIBUTION
        } as RasterSource;
        this.host.mapInstance.addSource(this.rasterSourceId, source);
        let layer = {
            id: this.rasterLayerId,
            type: "raster",
            source: this.rasterSourceId,
            layout: {
                visibility: (this.visible ? "visible" : "none") as "visible" | "none"
            } as RasterLayout,
            paint: {
                "raster-opacity": this.layerData.opacity || 1.0
            }
        } as Layer;
        this.host.mapInstance.addLayer(layer, this.before);
    }

    private removeRasterLayer() {
        this.host.mapInstance.removeLayer(this.rasterLayerId);
        this.host.mapInstance.removeSource(this.rasterSourceId);
    }

    private async createJsonLayer() {
        let response = await this.fileService
            .getStyleJsonContent(this.layerData.address, this.layerData.isOfflineOn || !this.hasInternetAccess);
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let styleJson = JSON.parse(JSON.stringify(response).replace(/name:he/g, `name:${language}`)) as Style;
        this.updateSourcesAndLayers(styleJson.sources, styleJson.layers);
    }

    private updateSourcesAndLayers(sources: Sources, layers: Layer[]) {
        let attributiuonUpdated = false;
        for (let sourceKey of Object.keys(sources)) {
            if (sources.hasOwnProperty(sourceKey) && this.visible) {
                let source = sources[sourceKey];
                if (!this.isBaselayer) {
                    sourceKey = this.layerData.key + "_" + sourceKey;
                }
                if (source.type === "vector") {
                    source.attribution = attributiuonUpdated === false ? AutomaticLayerPresentationComponent.ATTRIBUTION : "";
                    attributiuonUpdated = true;
                }
                this.jsonSourcesIds.push(sourceKey);
                this.host.mapInstance.addSource(sourceKey, source);
            }
        }
        for (let layer of layers) {
            if (this.isBaselayer || (this.visible && layer.metadata && layer.metadata["IHM:overlay"])) {
                if (!this.isBaselayer) {
                    layer.id = this.layerData.key + "_" + layer.id;
                    layer.source = this.layerData.key + "_" + layer.source;
                }
                this.jsonLayersIds.push(layer.id);
                this.host.mapInstance.addLayer(layer, this.before);
            }
        }
    }

    private removeJsonLayer() {
        for (let layerId of this.jsonLayersIds) {
            this.host.mapInstance.removeLayer(layerId);
        }
        this.jsonLayersIds = [];
        for (let sourceId of this.jsonSourcesIds) {
            this.host.mapInstance.removeSource(sourceId);
        }
        this.jsonSourcesIds = [];
    }

    private async createLayer() {
        if (this.isRaster(this.layerData.address)) {
            this.createRasterLayer();
        } else {
            await this.createJsonLayer();
        }
        if (this.isBaselayer) {
            this.host.mapInstance.setMinZoom(Math.max(this.layerData.minZoom - 1, 0));
        }
    }

    private removeLayer(address) {
        if (this.isRaster(address)) {
            this.removeRasterLayer();
        } else {
            this.removeJsonLayer();
        }
    }
}
