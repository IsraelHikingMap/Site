import { Component, OnInit, OnChanges, SimpleChanges, OnDestroy, OutputRefSubscription, inject, input } from "@angular/core";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import {
    StyleSpecification,
    RasterSourceSpecification,
    RasterLayerSpecification,
    SourceSpecification,
    LayerSpecification
} from "maplibre-gl";
import { Subject, mergeMap } from "rxjs";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../../services/resources.service";
import { FileService } from "../../services/file.service";
import { MapService } from "../../services/map.service";
import { LoggingService } from "../../services/logging.service";
import type { ApplicationState, EditableLayer, LanguageCode, LayerData } from "../../models";

@Component({
    selector: "auto-layer",
    templateUrl: "./automatic-layer-presentation.component.html"
})
export class AutomaticLayerPresentationComponent implements OnInit, OnChanges, OnDestroy {
    private static indexNumber = 0;

    private static readonly ATTRIBUTION = "<a href='https://github.com/IsraelHikingMap/Site/wiki/Attribution' target='_blank'>" +
        "Click me to see attribution</a>";

    public visible = input<boolean>();
    public before = input<string>();
    public isBaselayer = input<boolean>();
    public layerData = input<EditableLayer>();
    public isMainMap = input<boolean>();
    public isSameBaselayerOn = input<boolean>(false);

    private rasterSourceId: string;
    private rasterLayerId: string;
    private subscriptions: OutputRefSubscription[] = [];
    private jsonSourcesIds: string[] = [];
    private jsonLayersIds: string[] = [];
    private mapLoadedPromise: Promise<void>;
    private currentLanguageCode: LanguageCode;
    private recreateQueue: Subject<() => Promise<void>> = new Subject();

    public readonly resources = inject(ResourcesService);
    
    private readonly mapComponent = inject(MapComponent);
    private readonly fileService = inject(FileService);
    private readonly mapService = inject(MapService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    constructor() {
        const layerIndex = AutomaticLayerPresentationComponent.indexNumber++;
        this.rasterLayerId = `raster-layer-${layerIndex}`;
        this.rasterSourceId = `raster-source-${layerIndex}`;

        this.subscriptions.push(this.recreateQueue.pipe(mergeMap((action: () => Promise<void>) => action(), 1)).subscribe());
        this.mapLoadedPromise = new Promise((resolve, _) => {
            this.subscriptions.push(this.mapComponent.mapLoad.subscribe(() => {
                resolve();
            }));
        });
    }

    public ngOnInit() {
        this.addLayerRecreationQuqueItem(null, this.layerData());
        this.currentLanguageCode = this.store.selectSnapshot((s: ApplicationState) => s.configuration).language.code;
        this.subscriptions.push(this.store.select((state: ApplicationState) => state.configuration.language).subscribe((language) => {
            if (this.currentLanguageCode !== language.code) {
                this.addLayerRecreationQuqueItem(this.layerData(), this.layerData());
            }
            this.currentLanguageCode = language.code;
        }));
    }

    public ngOnDestroy() {
        this.addLayerRecreationQuqueItem(this.layerData(), null);
        this.recreateQueue.complete();
        for (const subscription of this.subscriptions) {
            subscription.unsubscribe();
        }
    }

    public ngOnChanges(changes: SimpleChanges) {
        if (changes.layerData?.firstChange) {
            return;
        }

        this.addLayerRecreationQuqueItem(changes.layerData ? changes.layerData.previousValue : this.layerData(), this.layerData());
    }

    private isRaster(address: string) {
        return address.match(/\.json(\?.+)?$/i) == null;
    }

    private createRasterLayer(layerData: LayerData) {
        let address = layerData.address;
        let scheme = "xyz";
        if (layerData.address.match(/\/MapServer(\/\d+)?$/i) != null) {
            address += "/export?dpi=96&transparent=true&format=png32&bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&f=image";
        } else if (layerData.address.indexOf("{-y}") !== -1) {
            address = address.replace("{-y}", "{y}");
            scheme = "tms";
        }
        const source = {
            type: "raster",
            tiles: [address],
            minzoom: Math.max(layerData.minZoom - 1, 0),
            maxzoom: layerData.maxZoom,
            scheme,
            tileSize: 256,
            attribution: AutomaticLayerPresentationComponent.ATTRIBUTION
        } as RasterSourceSpecification;
        this.mapComponent.mapInstance.addSource(this.rasterSourceId, source);
        const layer = {
            id: this.rasterLayerId,
            type: "raster",
            source: this.rasterSourceId,
            layout: {
                visibility: (this.visible() ? "visible" : "none") as "visible" | "none"
            },
            paint: {
                "raster-opacity": layerData.opacity || 1.0
            }
        } as RasterLayerSpecification;
        this.mapComponent.mapInstance.addLayer(layer, this.before());
    }

    private removeRasterLayer() {
        this.mapComponent.mapInstance.removeLayer(this.rasterLayerId);
        this.mapComponent.mapInstance.removeSource(this.rasterSourceId);
    }

    private async createJsonLayer(layerData: EditableLayer) {
        const tryLocalStyle = this.isMainMap() && layerData.isOfflineAvailable && this.store.selectSnapshot((s: ApplicationState) => s.offlineState).downloadedTiles != null;
        const response = await this.fileService.getStyleJsonContent(layerData.address, tryLocalStyle);
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const styleJson = JSON.parse(JSON.stringify(response).replace(/name:he/g, `name:${language}`)) as StyleSpecification;
        if (tryLocalStyle) {
            for (const source of Object.values(styleJson.sources)) {
                if (source.type === "vector") {
                    delete source.url;
                    source.tiles[0] = source.tiles[0].replace("https://", "slice://");
                }
                if (source.type === "raster-dem" ) {
                    delete source.url;
                    source.tiles[0] = source.tiles[0].replace("https://", "slice://");
                }
            }
        }
        this.updateSourcesAndLayers(layerData, styleJson.sources, styleJson.layers);
    }

    private updateSourcesAndLayers(layerData: LayerData, sources: {[_: string]: SourceSpecification}, layers: LayerSpecification[]) {
        this.loggingService.debug("Updaiting sources and layer, vis: " + this.visible() + ", main: " + this.isMainMap() + " ,sources: " + JSON.stringify(sources) + " ,layers: " + JSON.stringify(layers));
        if (!this.visible()) {
            return;
        }
        let attributiuonUpdated = false;
        for (let sourceKey of Object.keys(sources)) {
            const source = sources[sourceKey];
            if (!this.isBaselayer()) {
                sourceKey = layerData.key + "_" + sourceKey;
            }
            if (source.type === "vector") {
                source.attribution = attributiuonUpdated === false ? AutomaticLayerPresentationComponent.ATTRIBUTION : "";
                attributiuonUpdated = true;
            }

            try {
                this.mapComponent.mapInstance.addSource(sourceKey, source);
                this.jsonSourcesIds.push(sourceKey);
            } catch (ex) {
                this.loggingService.warning("Failed to add source: " + sourceKey + " " + (ex as any).message);
            }
            
        }
        for (const layer of layers) {
            if (!this.isBaselayer() && layer.metadata && !(layer.metadata as any)["IHM:overlay"]) {
                continue;
            }
            if (!this.isBaselayer() && layer.type === "background") {
                continue;
            }
            if (!this.isBaselayer() && layer.type !== "background") {
                layer.id = layerData.key + "_" + layer.id;
                layer.source = layerData.key + "_" + layer.source;
            }
            try {
                this.mapComponent.mapInstance.addLayer(layer, this.before());
                this.jsonLayersIds.push(layer.id);
            } catch (ex) {
                this.loggingService.warning("Failed to add layer: " + layer.id + " " + (ex as any).message);
            }
        }
    }

    private removeJsonLayer() {
        for (const layerId of this.jsonLayersIds) {
            this.mapComponent.mapInstance.removeLayer(layerId);
        }
        this.jsonLayersIds = [];
        for (const sourceId of this.jsonSourcesIds) {
            this.mapComponent.mapInstance.removeSource(sourceId);
        }
        this.jsonSourcesIds = [];
    }

    private async createLayer(layerData: EditableLayer) {
        if (this.isRaster(layerData.address)) {
            this.createRasterLayer(layerData);
        } else {
            await this.createJsonLayer(layerData);
        }
        if (this.isBaselayer()) {
            this.mapComponent.mapInstance.setMinZoom(Math.max(layerData.minZoom - 1, 0));
        }
    }

    private removeLayer(layerData: LayerData) {
        if (this.isRaster(layerData.address)) {
            this.removeRasterLayer();
        } else {
            this.removeJsonLayer();
        }
    }

    /**
     * This adds a recreate method to a queue that will run every time the previous recreate finishes.
     * This allows avoiding a race condition between the init and changes of this component.
     * @param oldLayer - the old layer data to remove
     * @param newLayer - the new layer data to add
     */
    private addLayerRecreationQuqueItem(oldLayer: LayerData, newLayer: EditableLayer) {
        this.recreateQueue.next(async () => {
            await (this.isMainMap() ? this.mapService.initializationPromise : this.mapLoadedPromise);
            if (oldLayer != null) {
                this.removeLayer(oldLayer);
            }
            if (newLayer != null && !this.isSameBaselayerOn()) {
                await this.createLayer(newLayer);
            }
        });
    }
}