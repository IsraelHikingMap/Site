import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { timeout } from "rxjs/operators";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { ResourcesService } from "./resources.service";
import {
    SPECIAL_BASELAYERS,
    SPECIAL_OVERLAYS
} from "../reducers/initial-state";
import {
    AddBaseLayerAction,
    UpdateBaseLayerAction,
    UpdateOverlayAction,
    SelectBaseLayerAction,
    RemoveOverlayAction,
    RemoveBaseLayerAction,
    AddOverlayAction,
    ToggleOfflineAction
} from "../reducers/layers.reducer";
import type {
    DataContainer,
    LayerData,
    EditableLayer,
    Overlay,
    ApplicationState,
    UserInfo,
} from "../models";
import { Urls } from "../urls";
import { LoggingService } from "./logging.service";


type UserLayer = (EditableLayer | Overlay) & {
    isOverlay: boolean;
    osmUserId: string;
}

@Injectable()
export class LayersService {
    public static readonly MIN_ZOOM = 7;
    public static readonly MAX_NATIVE_ZOOM = 16;

    private static CUSTOM_LAYER = "Custom Layer";

    private baseLayers: Immutable<EditableLayer[]> = [];
    private overlays: Immutable<Overlay[]> = [];
    private userInfo: Immutable<UserInfo>;
    private selectedBaseLayerKey: Immutable<string>;

    private readonly resources = inject(ResourcesService);
    private readonly httpClient = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    constructor() {
        this.store.select((state: ApplicationState) => state.layersState.baseLayers).subscribe(b => this.baseLayers = b);
        this.store.select((state: ApplicationState) => state.layersState.overlays).subscribe(o => this.overlays = o);
        this.store.select((state: ApplicationState) => state.layersState.selectedBaseLayerKey).subscribe(k => this.selectedBaseLayerKey = k);
        this.store.select((state: ApplicationState) => state.userState.userInfo).subscribe((userInfo) => {
            this.userInfo = userInfo;
            this.syncUserLayers();
        });
    }

    public isBaseLayerSelected(layer: EditableLayer): boolean {
        return this.compareKeys(layer.key, this.selectedBaseLayerKey);
    }

    public getSelectedBaseLayer(): EditableLayer {
        return this.baseLayers.find(bl => this.compareKeys(bl.key, this.selectedBaseLayerKey)) || this.baseLayers[0];
    }

    public getSelectedBaseLayerAddressForOSM(): string {
        const baseLayerAddress = this.getSelectedBaseLayer().address;
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
            for (const layer of data) {
                if (layer.isOverlay) {
                    const existingOverlay = this.overlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layer.key));
                    if (existingOverlay) {
                        this.store.dispatch(new UpdateOverlayAction(layer.key, {
                                ...existingOverlay,
                                ...layer // override
                            }
                        ));
                        continue;
                    }
                    this.addOverlayFromData(layer, false);
                } else {
                    const existingBaselayer = this.baseLayers.find((baseLayerToFind) => this.compareKeys(baseLayerToFind.key, layer.key));
                    if (existingBaselayer) {
                        this.store.dispatch(new UpdateBaseLayerAction(layer.key, {
                                ...existingBaselayer,
                                ...layer // override
                            }
                        ));
                        continue;
                    }
                    this.addBaseLayerFromData(layer);
                }
            }
            const overlaysToRemove = [];
            for (const overlay of this.overlays.filter(o => o.isEditable)) {
                if (data.find(l => l.key === overlay.key) == null) {
                    overlaysToRemove.push(overlay);
                }
            }
            for (const toRemove of overlaysToRemove) {
                this.store.dispatch(new RemoveOverlayAction(toRemove.key));
            }
            const baselayerToRemove = [];
            for (const baselayer of this.baseLayers.filter(o => o.isEditable)) {
                if (data.find(l => l.key === baselayer.key) == null) {
                    baselayerToRemove.push(baselayer);
                }
            }
            for (const toRemove of baselayerToRemove) {
                this.store.dispatch(new RemoveBaseLayerAction(toRemove.key));
            }
        } catch {
            this.loggingService.warning("[Layers] Unable to sync user layer from server - using local layers");
        }
    }

    public addBaseLayer(layerData: LayerData) {
        let layer = this.baseLayers.find((layerToFind) => this.compareKeys(layerToFind.key, layerData.key));
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
            isEditable: true,
            isOfflineAvailable: false,
            isOfflineOn: false
        } as EditableLayer;
        this.store.dispatch(new AddBaseLayerAction(baseLayer));
        return baseLayer;
    }

    private async addBaseLayerToDatabase(layer: Immutable<EditableLayer>) {
        if (SPECIAL_BASELAYERS.includes(layer.key)) {
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

    public addOverlay(layerData: LayerData): Overlay {
        let overlay = this.overlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layerData.key));
        if (overlay != null) {
            return overlay; // overlay exists
        }
        overlay = this.addOverlayFromData(layerData, true);
        this.addOverlayToDatabase(overlay);
        return overlay;
    }

    private addOverlayFromData(layerData: LayerData, visible: boolean): Immutable<Overlay> {
        const overlay = {
            ...layerData,
            visible,
            isEditable: true,
            isOfflineAvailable: false,
            isOfflineOn: false,
        } as Overlay;
        this.store.dispatch(new AddOverlayAction(overlay));
        return overlay;
    }

    private async addOverlayToDatabase(layer: Immutable<Overlay>) {
        if (SPECIAL_OVERLAYS.includes(layer.key)) {
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
        const layers: Immutable<EditableLayer[]> = isOverlay ? this.overlays : this.baseLayers;
        if (newName === key) {
            return true;
        }
        if (!newName) {
            return false;
        }
        return layers.find(l => this.compareKeys(l.key, newName)) == null;
    }

    public updateBaseLayer(oldLayer: EditableLayer, newLayer: EditableLayer): void {
        this.store.dispatch(new UpdateBaseLayerAction(oldLayer.key, newLayer));
        this.selectBaseLayer(newLayer.key);
        this.updateUserLayerInDatabase(false, newLayer);
    }

    public updateOverlay(oldLayer: Immutable<Overlay>, newLayer: Overlay): void {
        this.store.dispatch(new UpdateOverlayAction(oldLayer.key, newLayer));
        this.updateUserLayerInDatabase(true, newLayer);
    }

    public removeBaseLayer(baseLayer: EditableLayer) {
        if (this.compareKeys(baseLayer.key, this.selectedBaseLayerKey)) {
            this.store.dispatch(new SelectBaseLayerAction(this.baseLayers[0].key));
        }
        this.store.dispatch(new RemoveBaseLayerAction(baseLayer.key));
        this.deleteUserLayerFromDatabase(baseLayer.id);
    }

    public removeOverlay(overlay: Overlay) {
        this.store.dispatch(new RemoveOverlayAction(overlay.key));
        this.deleteUserLayerFromDatabase(overlay.id);
    }

    public selectBaseLayer(key: string) {
        this.loggingService.info(`[Layers] Selecting base layer ${key}`);
        this.store.dispatch(new SelectBaseLayerAction(key));
    }

    public toggleOverlay(overlay: Overlay) {
        const newVisibility = !overlay.visible;
        this.loggingService.info(`[Layers] Changing visibility of ${overlay.key} to ${newVisibility ? "visible" : "hidden"}`);
        this.store.dispatch(new UpdateOverlayAction(overlay.key, {
                ...overlay,
                visible: newVisibility
            }
        ));
    }

    public isAllOverlaysHidden() {
        return this.overlays.filter(o => o.visible).length === 0;
    }

    public hideAllOverlays() {
        const visibleOverlays = this.overlays.filter(o => o.visible);
        for (const overlay of visibleOverlays) {
            this.toggleOverlay(overlay);
        }
    }

    public addExternalBaseLayer(layerData: LayerData) {
        if (layerData == null || (layerData.address === "" && layerData.key === "")) {
            return;
        }
        const baseLayer = this.baseLayers.find((baseLayerToFind) =>
            baseLayerToFind.address.toLocaleLowerCase() === layerData.address.toLocaleLowerCase() ||
            this.compareKeys(baseLayerToFind.key, layerData.key));
        if (baseLayer != null) {
            this.selectBaseLayer(baseLayer.key);
            return;
        }
        let key = layerData.key;
        if (key === "") {
            key = LayersService.CUSTOM_LAYER + " ";
            let index = 0;
            let layer: EditableLayer;
            let customName: string;
            do {
                index++;
                customName = key + index.toString();
                layer = this.baseLayers.find((baseLayerToFind) => baseLayerToFind.key === customName);
            } while (layer != null);
            key = customName;
            layerData.minZoom = LayersService.MIN_ZOOM;
            layerData.maxZoom = LayersService.MAX_NATIVE_ZOOM;
        }

        this.addBaseLayer({
            key,
            address: layerData.address,
            minZoom: layerData.minZoom,
            maxZoom: layerData.maxZoom,
            isEditable: true,
            isOfflineAvailable: false,
            isOfflineOn: false,
        } as EditableLayer);
    }

    public addExternalOverlays(overlays: Immutable<LayerData[]>) {
        if (!overlays || overlays.length === 0) {
            return;
        }
        for (const overlay of overlays) {
            const addedOverlay = this.addOverlay(overlay);
            if (!addedOverlay.visible) {
                this.toggleOverlay(addedOverlay);
            }
        }
        // hide overlays that are not part of the share:
        for (const overlay of this.overlays) {
            const externalOverlay = overlays.find(o => o.key === overlay.key || o.address === overlay.address);
            if (externalOverlay == null && overlay.visible) {
                this.toggleOverlay(overlay);
            }
        }
    }

    public getData(): DataContainer {
        const container = {
            baseLayer: null,
            overlays: []
        } as DataContainer;

        container.baseLayer = this.getSelectedBaseLayer();
        const visibleOverlays = this.overlays.filter(overlay => overlay.visible);
        for (const overlay of visibleOverlays) {
            container.overlays.push(overlay);
        }
        return container;
    }

    private compareKeys(key1: string, key2: string): boolean {
        return key1.trim().toLowerCase() === key2.trim().toLowerCase();
    }

    public toggleOffline(layer: EditableLayer, isOverlay: boolean) {
        this.store.dispatch(new ToggleOfflineAction(layer.key, isOverlay));
    }
}
