import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Params } from "@angular/router";
import { firstValueFrom } from "rxjs";
import { timeout } from "rxjs/operators";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { ResourcesService } from "./resources.service";
import {
    DEFAULT_BASE_LAYERS,
    DEFAULT_OVERLAYS
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
    HideAllOverlaysAction
} from "../reducers/layers.reducer";
import type {
    DataContainer,
    LayerData,
    EditableLayer,
    ApplicationState,
    UserInfo,
} from "../models";
import { Urls } from "../urls";
import { LoggingService } from "./logging.service";


type UserLayer = EditableLayer & {
    isOverlay: boolean;
    osmUserId: string;
}

@Injectable()
export class LayersService {
    private allBaseLayers: Immutable<EditableLayer[]> = [];
    private allOverlays: Immutable<EditableLayer[]> = [];
    private userInfo: Immutable<UserInfo>;
    private selectedBaseLayerKey: Immutable<string>;

    private readonly resources = inject(ResourcesService);
    private readonly httpClient = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);
    private syncingPromise = Promise.resolve();

    constructor() {
        this.store.select((state: ApplicationState) => state.layersState.baseLayers).subscribe(userBaseLayers => {
            this.allBaseLayers = [...DEFAULT_BASE_LAYERS, ...userBaseLayers];
        });
        this.store.select((state: ApplicationState) => state.layersState.overlays).subscribe(userOverlays => {
            this.allOverlays = [...DEFAULT_OVERLAYS, ...userOverlays];
        });
        this.store.select((state: ApplicationState) => state.layersState.selectedBaseLayerKey).subscribe(k => this.selectedBaseLayerKey = k);
        this.store.select((state: ApplicationState) => state.userState.userInfo).subscribe((userInfo) => {
            this.userInfo = userInfo;
            this.syncingPromise = this.syncUserLayers();
        });
    }

    public isBaseLayerSelected(layer: EditableLayer): boolean {
        return this.compareKeys(layer.key, this.selectedBaseLayerKey);
    }

    public getSelectedBaseLayer(): EditableLayer {
        return this.allBaseLayers.find(bl => this.compareKeys(bl.key, this.selectedBaseLayerKey)) || this.allBaseLayers[0];
    }

    public getAllOverlays(): Immutable<EditableLayer[]> {
        return this.allOverlays;
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
        let layer = this.allBaseLayers.find((layerToFind) => this.compareKeys(layerToFind.key, layerData.key));
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
        let overlay = this.allOverlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layerData.key));
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
            isEditable: true,
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
        const layers: Immutable<EditableLayer[]> = isOverlay ? this.allOverlays : this.allBaseLayers;
        return layers.find(l => this.compareKeys(l.key, newName)) == null;
    }

    public updateBaseLayer(oldLayer: EditableLayer, newLayer: EditableLayer): void {
        this.store.dispatch(new UpdateBaseLayerAction(oldLayer.key, newLayer));
        this.selectBaseLayer(newLayer.key);
        this.updateUserLayerInDatabase(false, newLayer);
    }

    public updateOverlay(oldLayer: Immutable<EditableLayer>, newLayer: EditableLayer): void {
        this.store.dispatch(new UpdateOverlayAction(oldLayer.key, newLayer));
        this.updateUserLayerInDatabase(true, newLayer);
    }

    public removeBaseLayer(baseLayer: EditableLayer) {
        if (this.compareKeys(baseLayer.key, this.selectedBaseLayerKey)) {
            this.store.dispatch(new SelectBaseLayerAction(this.allBaseLayers[0].key));
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
        const visibleOverlays = this.store.selectSnapshot((state: ApplicationState) => state.layersState.visibleOverlays);
        const isLayerVisible = visibleOverlays.includes(overlay.key);
        this.loggingService.info(`[Layers] Changing visibility of ${overlay.key} to ${!isLayerVisible ? "visible" : "hidden"}`);
        this.store.dispatch(new SetOverlaysVisibilityAction(overlay.key, !isLayerVisible));
    }

    public isOverlayVisible(overlay: EditableLayer): boolean {
        return this.store.selectSnapshot((state: ApplicationState) => state.layersState.visibleOverlays).includes(overlay.key);
    }

    public isAllOverlaysHidden() {
        return this.store.selectSnapshot((state: ApplicationState) => state.layersState.visibleOverlays).length === 0;
    }

    public hideAllOverlays() {
        this.store.dispatch(new HideAllOverlaysAction());
    }

    public getData(): DataContainer {
        const container = {
            baseLayer: null,
            overlays: []
        } as DataContainer;

        container.baseLayer = this.getSelectedBaseLayer();
        for (const overlayKey of this.store.selectSnapshot((state: ApplicationState) => state.layersState.visibleOverlays)) {
            container.overlays.push(this.allOverlays.find(o => this.compareKeys(o.key, overlayKey)));
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
            opacity: +queryParams["opacity"],
        }
        if (queryParams["isoverlay"].toString() == "true") {
            this.addOverlay(layerData);
        } else {
            this.addBaseLayer(layerData);
            this.selectBaseLayer(layerData.key);
        }
    }
}
