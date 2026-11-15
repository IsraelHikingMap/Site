import { inject, computed, Service } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Params } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { timeout } from "rxjs/operators";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { ResourcesService } from "./resources.service";
import {
    DEFAULT_BASE_LAYERS,
    DEFAULT_OVERLAYS,
    SUBSCRIBED_BASE_LAYERS,
    HIKING_MAP,
    MTB_MAP,
    OPEN_HEATMAP,
    SATELLITE_MAP
} from "../reducers/initial-state";
import {
    AddBaseLayerAction,
    UpdateBaseLayerAction,
    UpdateOverlayAction,
    SelectBaseLayerAction,
    RemoveOverlayAction,
    RemoveBaseLayerAction,
    AddOverlayAction,
    SetOverlaysVisibilityAction,
    HideAllOverlaysAction,
    SetLayerShownInPanelAction
} from "../reducers/layers.reducer";
import type {
    DataContainer,
    LayerData,
    EditableLayer,
    ApplicationState,
    UserInfo
} from "../models";
import { Urls } from "../urls";
import { LoggingService } from "./logging.service";
import { SpatialHelper } from "./spatial.helper";


/**
 * Images of the built-in layers, rendered from their styles at zoom 12.5 over the Carmel with the labels
 * hidden. A vector style has no single tile a browser could show instead.
 */
const LAYER_THUMBNAILS: Record<string, string> = {
    [HIKING_MAP]: "content/layer-thumbnails/hiking.webp",
    [MTB_MAP]: "content/layer-thumbnails/mtb.webp",
    [OPEN_HEATMAP]: "content/layer-thumbnails/heatmap.webp",
    [SATELLITE_MAP]: "content/layer-thumbnails/satellite.webp"
};

type UserLayer = EditableLayer & {
    isOverlay: boolean;
    osmUserId: string;
}

@Service()
export class LayersService {
    private userInfo: Immutable<UserInfo>;

    private readonly resources = inject(ResourcesService);
    private readonly httpClient = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private syncingPromise = Promise.resolve();

    // Reactive views over the layers state; the getters below read these so that components binding
    // to LayersService methods stay up to date under OnPush change detection.
    private readonly userBaseLayers = this.store.selectSignal((state: ApplicationState) => state.layersState.baseLayers);
    private readonly userOverlays = this.store.selectSignal((state: ApplicationState) => state.layersState.overlays);
    private readonly selectedBaseLayerKey = this.store.selectSignal((state: ApplicationState) => state.layersState.selectedBaseLayerKey);
    private readonly visibleOverlays = this.store.selectSignal((state: ApplicationState) => state.layersState.visibleOverlays);
    private readonly isSubscribed = this.store.selectSignal((state: ApplicationState) => state.offlineState.isSubscribed);
    private readonly hiddenBaseLayers = this.store.selectSignal((state: ApplicationState) => state.layersState.hiddenBaseLayers);
    private readonly hiddenOverlays = this.store.selectSignal((state: ApplicationState) => state.layersState.hiddenOverlays);
    private readonly location = this.store.selectSignal((state: ApplicationState) => state.locationState);
    /**
     * The base layers that come with the application, which are the built in ones and, for a subscribed
     * user, the ones that are a part of the subscription.
     */
    public readonly defaultBaseLayers = computed<Immutable<EditableLayer[]>>(() =>
        this.isSubscribed() ? [...DEFAULT_BASE_LAYERS, ...SUBSCRIBED_BASE_LAYERS] : DEFAULT_BASE_LAYERS);
    /**
     * The base layers of the subscription that a user without one can not use, listed anyway so the user
     * knows what a subscription would add.
     */
    public readonly lockedBaseLayers = computed<Immutable<EditableLayer[]>>(() =>
        this.isSubscribed() ? [] : SUBSCRIBED_BASE_LAYERS);
    private readonly allBaseLayers = computed<Immutable<EditableLayer[]>>(() => [...this.defaultBaseLayers(), ...this.userBaseLayers()]);
    // Reactive derived state exposed as signals (explicit reactive contract; parameterized predicates
    // isBaseLayerSelected()/isOverlayVisible() stay methods since a signal can't take an argument).
    public readonly allOverlays = computed<Immutable<EditableLayer[]>>(() => [...DEFAULT_OVERLAYS, ...this.userOverlays()]);
    public readonly selectedBaseLayer = computed<EditableLayer>(() => this.allBaseLayers().find(bl => this.compareKeys(bl.key, this.selectedBaseLayerKey())) || this.allBaseLayers()[0]);
    public readonly isAllOverlaysHidden = computed(() => this.visibleOverlays().length === 0);

    constructor() {
        this.store.select((state: ApplicationState) => state.userState.userInfo).subscribe((userInfo) => {
            this.userInfo = userInfo;
            this.syncingPromise = this.syncUserLayers();
        });
    }

    public isBaseLayerSelected(layer: EditableLayer): boolean {
        return this.compareKeys(layer.key, this.selectedBaseLayerKey());
    }

    public getSelectedBaseLayerAddressForOSM(): string {
        const baseLayerAddress = this.selectedBaseLayer().address;
        if (baseLayerAddress.indexOf("{x}") !== -1) {
            return baseLayerAddress;
        }
        const defaultAddress = Urls.baseTilesAddress + "/Hebrew/Tiles/{z}/{x}/{y}.png";
        // using the same logic that the server is using in ImageCreationService + language
        if (!baseLayerAddress) {
            return defaultAddress;
        }
        const language = this.resources.getCurrentLanguageCodeSimplified() === "he" ? "Hebrew" : "English";
        let tiles = "Tiles";
        if (baseLayerAddress.endsWith(".json")) {
            const styleKey = baseLayerAddress.replace(".json", "").split("/").splice(-1)[0];
            if (styleKey === "ilMTB") {
                tiles = "mtbTiles";
            }
        }
        return `${Urls.baseTilesAddress}/${language}/${tiles}/{z}/{x}/{y}.png`;
    }

    private async syncUserLayers(): Promise<void> {
        if (!this.userInfo) {
            return;
        }
        try {
            const data = await firstValueFrom(this.httpClient.get<UserLayer[]>(Urls.userLayers).pipe(timeout(10000)));
            if (data == null) {
                return;
            }
            const userOverlays = this.store.selectSnapshot((state: ApplicationState) => state.layersState.overlays);
            const userBaselayers = this.store.selectSnapshot((state: ApplicationState) => state.layersState.baseLayers);
            for (const layer of data) {
                if (layer.isOverlay) {
                    const existingOverlay = userOverlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layer.key));
                    if (existingOverlay) {
                        this.store.dispatch(new UpdateOverlayAction(layer.key, {
                            ...existingOverlay,
                            ...layer // override
                        }));
                        continue;
                    }
                    this.addOverlayFromData(layer, false);
                } else {
                    const existingBaselayer = userBaselayers.find((baseLayerToFind) => this.compareKeys(baseLayerToFind.key, layer.key));
                    if (existingBaselayer) {
                        this.store.dispatch(new UpdateBaseLayerAction(layer.key, {
                            ...existingBaselayer,
                            ...layer // override
                        }));
                        continue;
                    }
                    this.addBaseLayerFromData(layer);
                }
            }
            for (const overlay of userOverlays) {
                if (data.find(l => this.compareKeys(l.key, overlay.key)) == null) {
                    this.store.dispatch(new RemoveOverlayAction(overlay.key));
                }
            }
            for (const baselayer of userBaselayers) {
                if (data.find(l => this.compareKeys(l.key, baselayer.key)) == null) {
                    this.store.dispatch(new RemoveBaseLayerAction(baselayer.key));
                }
            }
        } catch {
            this.loggingService.warning("[Layers] Unable to sync user layer from server - using local layers");
        }
    }

    public addBaseLayer(layerData: LayerData) {
        let layer = this.allBaseLayers().find((layerToFind) => this.compareKeys(layerToFind.key, layerData.key));
        if (layer != null) {
            return;
        }
        layer = this.addBaseLayerFromData(layerData);
        this.selectBaseLayer(layerData.key);
        this.addBaseLayerToDatabase(layer);
    }

    private addBaseLayerFromData(layerData: LayerData): Immutable<EditableLayer> {
        const baseLayer = {
            ...layerData,
            isEditable: true
        } as EditableLayer;
        this.store.dispatch(new AddBaseLayerAction(baseLayer));
        return baseLayer;
    }

    private async addBaseLayerToDatabase(layer: Immutable<EditableLayer>) {
        if (DEFAULT_BASE_LAYERS.some(l => this.compareKeys(l.key, layer.key))) {
            return;
        }
        if (!this.userInfo) {
            return;
        }
        const layerToStore = { ...layer } as UserLayer;
        layerToStore.isOverlay = false;
        layerToStore.osmUserId = this.userInfo.id;
        const response = await firstValueFrom(this.httpClient.post<UserLayer>(Urls.userLayers, layerToStore));
        this.store.dispatch(new UpdateBaseLayerAction(layer.key, {
            ...layer,
            id: response.id
        }));
    }

    private async updateUserLayerInDatabase(isOverlay: boolean, layer: Immutable<EditableLayer>) {
        if (!this.userInfo) {
            return;
        }
        const layerToStore = { ...layer } as UserLayer;
        layerToStore.isOverlay = isOverlay;
        layerToStore.osmUserId = this.userInfo.id;
        layerToStore.id = layer.id;
        await firstValueFrom(this.httpClient.put(Urls.userLayers + layerToStore.id, layerToStore));
    }

    private async deleteUserLayerFromDatabase(id: string) {
        if (this.userInfo) {
            await firstValueFrom(this.httpClient.delete(Urls.userLayers + id));
        }
    }

    public addOverlay(layerData: LayerData): EditableLayer {
        let overlay = this.allOverlays().find((overlayToFind) => this.compareKeys(overlayToFind.key, layerData.key));
        if (overlay != null) {
            return overlay; // overlay exists
        }
        overlay = this.addOverlayFromData(layerData, true);
        this.addOverlayToDatabase(overlay);
        return overlay;
    }

    private addOverlayFromData(layerData: LayerData, visible: boolean): Immutable<EditableLayer> {
        const overlay = {
            ...layerData,
            isEditable: true
        } as EditableLayer;
        this.store.dispatch(new AddOverlayAction(overlay));
        this.store.dispatch(new SetOverlaysVisibilityAction(overlay.key, visible));
        return overlay;
    }

    private async addOverlayToDatabase(layer: Immutable<EditableLayer>) {
        if (DEFAULT_OVERLAYS.some(l => this.compareKeys(l.key, layer.key))) {
            return;
        }
        if (!this.userInfo) {
            return;
        }
        const layerToStore = { ...layer } as UserLayer;
        layerToStore.isOverlay = true;
        layerToStore.osmUserId = this.userInfo.id;
        const response = await firstValueFrom(this.httpClient.post<UserLayer>(Urls.userLayers, layerToStore));
        this.store.dispatch(new UpdateOverlayAction(layer.key, {
            ...layer,
            id: response.id
        }));
    }

    public isNameAvailable(key: string, newName: string, isOverlay: boolean): boolean {
        const layers: Immutable<EditableLayer[]> = isOverlay ? this.allOverlays() : this.allBaseLayers();
        return layers.find(l => this.compareKeys(l.key, newName)) == null;
    }

    public updateBaseLayer(oldLayer: EditableLayer, newLayer: EditableLayer): void {
        const wasSelected = this.compareKeys(oldLayer.key, this.selectedBaseLayerKey());
        this.store.dispatch(new UpdateBaseLayerAction(oldLayer.key, newLayer));
        if (wasSelected) {
            this.selectBaseLayer(newLayer.key);
        }
        this.updateUserLayerInDatabase(false, newLayer);
    }

    public updateOverlay(oldLayer: Immutable<EditableLayer>, newLayer: EditableLayer): void {
        this.store.dispatch(new UpdateOverlayAction(oldLayer.key, newLayer));
        this.updateUserLayerInDatabase(true, newLayer);
    }

    public removeBaseLayer(baseLayer: EditableLayer) {
        if (this.compareKeys(baseLayer.key, this.selectedBaseLayerKey())) {
            this.store.dispatch(new SelectBaseLayerAction(this.allBaseLayers()[0].key));
        }
        this.store.dispatch(new RemoveBaseLayerAction(baseLayer.key));
        this.deleteUserLayerFromDatabase(baseLayer.id);
    }

    public removeOverlay(overlay: EditableLayer) {
        this.store.dispatch(new RemoveOverlayAction(overlay.key));
        this.deleteUserLayerFromDatabase(overlay.id);
    }

    public selectBaseLayer(key: string) {
        this.loggingService.info(`[Layers] Selecting base layer ${key}`);
        this.store.dispatch(new SelectBaseLayerAction(key));
    }

    public toggleOverlay(overlay: EditableLayer) {
        const visibleOverlays = this.visibleOverlays();
        const isLayerVisible = visibleOverlays.includes(overlay.key);
        this.loggingService.info(`[Layers] Changing visibility of ${overlay.key} to ${!isLayerVisible ? "visible" : "hidden"}`);
        this.store.dispatch(new SetOverlaysVisibilityAction(overlay.key, !isLayerVisible));
    }

    /**
     * Whether the layers panel lists the layer. A layer the user hid from it is still listed while it is in
     * use - the selected base layer or a visible overlay - so it can always be switched off from the panel.
     */
    public isShownInPanel(layer: Immutable<EditableLayer>, isOverlay: boolean): boolean {
        const hiddenKeys = isOverlay ? this.hiddenOverlays() : this.hiddenBaseLayers();
        if (!hiddenKeys.includes(layer.key)) {
            return true;
        }
        return isOverlay ? this.isOverlayVisible(layer as EditableLayer) : this.isBaseLayerSelected(layer as EditableLayer);
    }

    public setShownInPanel(key: string, isOverlay: boolean, shown: boolean) {
        this.store.dispatch(new SetLayerShownInPanelAction(key, isOverlay, shown));
    }

    /**
     * The image a layer is shown with: a built-in layer has one rendered from its style, and a raster layer
     * shows its own tile around the map's center. Any other layer has none, and is shown by its initials.
     */
    public getThumbnail(layer: Immutable<EditableLayer>): string {
        if (LAYER_THUMBNAILS[layer.key]) {
            return LAYER_THUMBNAILS[layer.key];
        }
        const address = layer.address ?? "";
        if (!address.includes("{z}") || !address.includes("{x}") || !(address.includes("{y}") || address.includes("{-y}"))) {
            return null;
        }
        const location = this.location();
        const zoom = Math.min(Math.max(Math.round(location.zoom) - 1, layer.minZoom ?? 0), layer.maxZoom ?? 18);
        const tile = SpatialHelper.toTile({ lat: location.latitude, lng: location.longitude }, zoom);
        const x = Math.floor(tile.x);
        const y = Math.floor(tile.y);
        return address
            .replace("{z}", `${zoom}`)
            .replace("{x}", `${x}`)
            .replace("{y}", `${y}`)
            .replace("{-y}", `${Math.pow(2, zoom) - 1 - y}`)
            .replace("{s}", "a");
    }

    public isOverlayVisible(overlay: EditableLayer): boolean {
        return this.visibleOverlays().includes(overlay.key);
    }

    public hideAllOverlays() {
        this.store.dispatch(new HideAllOverlaysAction());
    }

    public getData(): DataContainer {
        const container = {
            baseLayer: null,
            overlays: []
        } as DataContainer;

        container.baseLayer = this.selectedBaseLayer();
        for (const overlayKey of this.visibleOverlays()) {
            const overlay = this.allOverlays().find(o => this.compareKeys(o.key, overlayKey));
            if (overlay != null) {
                container.overlays.push(overlay);
            }
        }
        return container;
    }

    private compareKeys(key1: string, key2: string): boolean {
        return key1.trim().toLowerCase() === key2.trim().toLowerCase();
    }

    public layerDataToAddress(layerData: LayerData, isOverlay: boolean) {
        const httpParams = new HttpParams()
            .set("key", layerData.key)
            .set("address", encodeURIComponent(layerData.address))
            .set("maxzoom", layerData.maxZoom)
            .set("minzoom", layerData.minZoom)
            .set("opacity", layerData.opacity)
            .set("isoverlay", isOverlay);
        return Urls.baseAddress + "/layer?" + httpParams.toString();
    }

    public async addLayerAfterNavigation(queryParams: Params) {
        await this.syncingPromise;
        const layerData: LayerData = {
            key: queryParams["key"],
            address: decodeURIComponent(queryParams["address"]),
            minZoom: +queryParams["minzoom"],
            maxZoom: +queryParams["maxzoom"],
            opacity: +queryParams["opacity"]
        }
        if (queryParams["isoverlay"].toString() == "true") {
            this.addOverlay(layerData);
        } else {
            this.addBaseLayer(layerData);
            this.selectBaseLayer(layerData.key);
        }
    }
}
