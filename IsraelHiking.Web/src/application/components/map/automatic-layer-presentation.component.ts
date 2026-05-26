import { Component, OnInit, OnChanges, SimpleChanges, OnDestroy, OutputRefSubscription, inject, input } from "@angular/core";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";
import { Subject, mergeMap } from "rxjs";
import { Store } from "@ngxs/store";
import type { SourceSpecification, LayerSpecification } from "maplibre-gl";

import { ResourcesService } from "../../services/resources.service";
import { DefaultStyleService } from "../../services/default-style.service";
import type { ApplicationState, EditableLayer, LanguageCode, LayerData } from "../../models";

@Component({
    selector: "auto-layer",
    templateUrl: "./automatic-layer-presentation.component.html"
})
export class AutomaticLayerPresentationComponent implements OnInit, OnChanges, OnDestroy {
    public visible = input<boolean>();
    public before = input<string>();
    public isBaselayer = input<boolean>();
    public layerData = input<EditableLayer>();
    public allowOffline = input<boolean>();

    private subscriptions: OutputRefSubscription[] = [];
    private jsonSourcesIds: string[] = [];
    private jsonLayersIds: string[] = [];
    private mapLoadedPromise: Promise<void>;
    private currentLanguageCode: LanguageCode;
    private recreateQueue = new Subject<() => Promise<void>>();

    public readonly resources = inject(ResourcesService);

    private readonly mapComponent = inject(MapComponent);
    private readonly defaultStyleService = inject(DefaultStyleService);
    private readonly store = inject(Store);

    constructor() {
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
        this.subscriptions.push(this.store.select((state: ApplicationState) => state.offlineState.downloadedTiles).subscribe(() => {
            this.addLayerRecreationQuqueItem(this.layerData(), this.layerData());
        }));
        this.subscriptions.push(this.store.select((state: ApplicationState) => state.configuration.units).subscribe(() => {
            this.addLayerRecreationQuqueItem(this.layerData(), this.layerData());
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

    private updateSourcesAndLayers(layerData: LayerData, sources: Record<string, SourceSpecification>, layers: LayerSpecification[]) {
        if (!this.visible()) {
            return;
        }
        for (let sourceKey of Object.keys(sources)) {
            const source = sources[sourceKey];
            if (!this.isBaselayer()) {
                sourceKey = layerData.key + "_" + sourceKey;
            }
            this.mapComponent.mapInstance.addSource(sourceKey, source);
            this.jsonSourcesIds.push(sourceKey);
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
            this.mapComponent.mapInstance.addLayer(layer, this.before());
            this.jsonLayersIds.push(layer.id);
        }
    }

    private async createLayer(layerData: EditableLayer) {
        const styleLike = await this.defaultStyleService.getSourcesAndLayers(layerData, this.visible(), this.allowOffline() ? "offline" : "online");
        this.updateSourcesAndLayers(layerData, styleLike.sources, styleLike.layers);

        if (this.isBaselayer()) {
            this.mapComponent.mapInstance.setMinZoom(Math.max(layerData.minZoom - 1, 0));
        }
    }

    private removeLayer() {
        for (const layerId of this.jsonLayersIds) {
            this.mapComponent.mapInstance.removeLayer(layerId);
        }
        this.jsonLayersIds = [];
        for (const sourceId of this.jsonSourcesIds) {
            this.mapComponent.mapInstance.removeSource(sourceId);
        }
        this.jsonSourcesIds = [];
    }

    /**
     * This adds a recreate method to a queue that will run every time the previous recreate finishes.
     * This allows avoiding a race condition between the init and changes of this component.
     * @param oldLayer - the old layer data to remove
     * @param newLayer - the new layer data to add
     */
    private addLayerRecreationQuqueItem(oldLayer: LayerData, newLayer: EditableLayer) {
        this.recreateQueue.next(async () => {
            if (!this.mapComponent.mapInstance?.loaded()) {
                await this.mapLoadedPromise;
            }
            if (oldLayer != null) {
                this.removeLayer();
            }
            if (newLayer != null) {
                await this.createLayer(newLayer);
            }
        });
    }
}