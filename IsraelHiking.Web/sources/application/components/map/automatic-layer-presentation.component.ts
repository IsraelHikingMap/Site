import { Component, Input, OnInit, OnChanges, SimpleChanges, OnDestroy } from "@angular/core";
import { MapComponent } from "ngx-mapbox-gl";
import { RasterSource, RasterLayout, Layer } from "mapbox-gl";
import { Subscription } from "rxjs";

import { FileService } from "../../services/file.service";
import { Urls } from "../../urls";

@Component({
    selector: "auto-layer",
    templateUrl: "./automatic-layer-presentation.component.html"
})
export class AutomaticLayerPresentationComponent implements OnInit, OnChanges, OnDestroy {
    private static indexNumber = 0;

    @Input()
    public address: string;
    @Input()
    public minZoom: number;
    @Input()
    public maxZoom: number;
    @Input()
    public opacity: number;
    @Input()
    public visible: boolean;
    @Input()
    public before: string;
    @Input()
    public isBaselayer: string;

    private rasterSourceId;
    private rasterLayerId;
    private sourceAdded: boolean;
    private subscription: Subscription;
    private jsonSourcesIds: string[];
    private jsonLayersIds: string[];

    constructor(private readonly host: MapComponent,
                private readonly fileService: FileService) {
        let layerIndex = AutomaticLayerPresentationComponent.indexNumber++;
        this.rasterLayerId = `raster-layer-${layerIndex}`;
        this.rasterSourceId = `raster-source-${layerIndex}`;
        this.sourceAdded = false;
        this.jsonSourcesIds = [];
        this.jsonLayersIds = [];
    }

    public ngOnInit() {
        if (this.host.mapInstance == null) {
            this.subscription = this.host.load.subscribe(() => {
                this.createLayer();
                this.sourceAdded = true;
            });
        } else {
            this.createLayer();
            this.sourceAdded = true;
        }
    }

    public ngOnDestroy() {
        if (this.subscription != null) {
            this.subscription.unsubscribe();
        }
        if (this.sourceAdded) {
            this.removeLayer(this.address);
            this.sourceAdded = false;
        }
    }

    async ngOnChanges(changes: SimpleChanges) {
        if (this.sourceAdded) {
            await this.removeLayer(changes.address.previousValue);
            this.createLayer();
        }
    }

    private isRaster(address: string) {
        return !address.endsWith("json");
    }

    private createRasterLayer() {
        let address = this.address;
        let scheme = "xyz";
        if (this.address.toLocaleLowerCase().endsWith("/mapserver")) {
            address += "/export?dpi=96&transparent=true&format=png32&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image";
        } else if (this.address.indexOf("{-y}") !== -1) {
            address = address.replace("{-y}", "{y}");
            scheme = "tms";
        }
        address = this.fixNonHttpsAddress(address);
        let source = {
            type: "raster",
            tiles: [address],
            minzoom: Math.max(this.minZoom - 1, 0),
            maxzoom: this.maxZoom - 1,
            scheme,
            tileSize: 256
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
                "raster-opacity": this.opacity || 1.0
            }
        } as Layer;
        this.host.mapInstance.addLayer(layer, this.before);
    }

    private removeRasterLayer() {
        this.host.mapInstance.removeLayer(this.rasterLayerId);
        this.host.mapInstance.removeSource(this.rasterSourceId);
    }

    private async createJsonLayer() {
        let response = await this.fileService.getStyleJsonContent(this.fixNonHttpsAddress(this.address));
        for (let source in response.sources) {
            if (response.sources.hasOwnProperty(source)) {
                this.jsonSourcesIds.push(source);
                this.host.mapInstance.addSource(source, response.sources[source]);
            }
        }
        for (let layer of response.layers) {
            this.jsonLayersIds.push(layer.id);
            this.host.mapInstance.addLayer(layer, this.before);
        }
    }

    private fixNonHttpsAddress(address: string) {
        if (address.startsWith("http://")) {
            return Urls.proxy + address;
        }
        return address;
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
        if (this.isRaster(this.address)) {
            this.createRasterLayer();
        } else {
            await this.createJsonLayer();
        }
        if (this.isBaselayer) {
            this.host.mapInstance.setMinZoom(this.minZoom - 1);
        }
    }

    private async removeLayer(address) {
        if (this.isRaster(address)) {
            this.removeRasterLayer();
        } else {
            await this.removeJsonLayer();
        }
    }
}
