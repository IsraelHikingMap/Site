import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Observable } from "rxjs";
import { timeout } from "rxjs/operators";

import { ResourcesService } from "../resources.service";
import { AuthorizationService } from "../authorization.service";
import { ToastService } from "../toast.service";
import { NgRedux, select } from "../../reducers/infra/ng-redux.module";
import {
    ISRAEL_HIKING_MAP,
    ISRAEL_MTB_MAP,
    SATELLITE,
    ESRI,
    HIKING_TRAILS,
    BICYCLE_TRAILS
} from "../../reducers/initial-state";
import {
    AddBaseLayerAction,
    UpdateBaseLayerAction,
    UpdateOverlayAction,
    SelectBaseLayerAction,
    RemoveOverlayAction,
    RemoveBaseLayerAction,
    AddOverlayAction,
    ToggleOfflineAction,
} from "../../reducers/layers.reducer";
import type {
    DataContainer,
    LayerData,
    EditableLayer,
    Overlay,
    ApplicationState,
    UserInfo
} from "../../models/models";
import { Urls } from "../../urls";

import { LoggingService } from "../logging.service";

interface IUserLayer extends LayerData {
    isOverlay: boolean;
    osmUserId: string;
    id: string;
}

@Injectable()
export class LayersService {
    public static readonly MIN_ZOOM = 7;
    public static readonly MAX_NATIVE_ZOOM = 16;

    private static CUSTOM_LAYER = "Custom Layer";

    private baseLayers: EditableLayer[];
    private overlays: Overlay[];
    private selectedBaseLayerKey: string;

    @select((state: ApplicationState) => state.layersState.baseLayers)
    public baseLayers$: Observable<EditableLayer[]>;

    @select((state: ApplicationState) => state.layersState.overlays)
    public overlays$: Observable<Overlay[]>;

    @select((state: ApplicationState) => state.layersState.selectedBaseLayerKey)
    public selectedBaseLayerKey$: Observable<string>;

    @select((state: ApplicationState) => state.userState.userInfo)
    public userInfo$: Observable<UserInfo>;

    constructor(private readonly resources: ResourcesService,
                private readonly authorizationService: AuthorizationService,
                private readonly httpClient: HttpClient,
                private readonly toastService: ToastService,
                private readonly loggingService: LoggingService,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        this.baseLayers = [];
        this.overlays = [];

        this.baseLayers$.subscribe(b => this.baseLayers = b);
        this.overlays$.subscribe(o => this.overlays = o);
        this.selectedBaseLayerKey$.subscribe(k => this.selectedBaseLayerKey = k);

        this.userInfo$.subscribe(() => this.syncUserLayers());
    }

    public isBaseLayerSelected(layer: EditableLayer): boolean {
        return this.compareKeys(layer.key, this.selectedBaseLayerKey);
    }

    public getSelectedBaseLayer(): EditableLayer {
        return this.baseLayers.find(bl => this.compareKeys(bl.key, this.selectedBaseLayerKey)) || this.baseLayers[0];
    }

    public getSelectedBaseLayerAddressForOSM(): string {
        let baseLayerAddress = this.getSelectedBaseLayer().address;
        if (baseLayerAddress.indexOf("{x}") !== -1) {
            return baseLayerAddress;
        }
        let defaultAddress = Urls.baseTilesAddress + "/Hebrew/Tiles/{z}/{x}/{y}.png";
        // using the same logic that the server is using in ImageCreationService + language
        if (!baseLayerAddress) {
            return defaultAddress;
        }
        let language = this.resources.getCurrentLanguageCodeSimplified() === "he" ? "Hebrew" : "English";
        let tiles = "Tiles";
        if (baseLayerAddress.endsWith(".json")) {
            let styleKey = baseLayerAddress.replace(".json", "").split("/").splice(-1)[0];
            if (styleKey === "ilMTB") {
                tiles = "mtbTiles";
            }
        }
        return `${Urls.baseTilesAddress}/${language}/${tiles}/{z}/{x}/{y}.png`;
    }

    private async syncUserLayers(): Promise<void> {
        if (!this.authorizationService.isLoggedIn()) {
            return;
        }
        try {
            let data = await this.httpClient.get(Urls.userLayers).pipe(timeout(10000)).toPromise() as IUserLayer[];
            if (data == null) {
                return;
            }
            for (let layer of data) {
                if (layer.isOverlay) {
                    let existingOverlay = this.overlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layer.key));
                    if (existingOverlay) {
                        this.ngRedux.dispatch(new UpdateOverlayAction({
                            key: layer.key,
                            layerData: {
                                ...existingOverlay,
                                ...layer // override
                            }
                        }));
                        continue;
                    }
                    this.addOverlayFromData(layer, false);
                } else {
                    let existingBaselayer = this.baseLayers.find((baseLayerToFind) => this.compareKeys(baseLayerToFind.key, layer.key));
                    if (existingBaselayer) {
                        this.ngRedux.dispatch(new UpdateBaseLayerAction({
                            key: layer.key,
                            layerData: {
                                ...existingBaselayer,
                                ...layer // override
                            }
                        }));
                        continue;
                    }
                    this.addBaseLayerFromData(layer);
                }
            }
            let overlaysToRemove = [];
            for (let overlay of this.overlays.filter(o => o.isEditable)) {
                if (data.find(l => l.key === overlay.key) == null) {
                    overlaysToRemove.push(overlay);
                }
            }
            for (let toRemove of overlaysToRemove) {
                this.ngRedux.dispatch(new RemoveOverlayAction({
                    key: toRemove.key
                }));
            }
            let baselayerToRemove = [];
            for (let baselayer of this.baseLayers.filter(o => o.isEditable)) {
                if (data.find(l => l.key === baselayer.key) == null) {
                    baselayerToRemove.push(baselayer);
                }
            }
            for (let toRemove of baselayerToRemove) {
                this.ngRedux.dispatch(new RemoveBaseLayerAction({
                    key: toRemove.key
                }));
            }
        } catch (error) {
            this.loggingService.warning("Unable to sync user layer from server - using local layers");
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

    private addBaseLayerFromData(layerData: LayerData): EditableLayer {
        let baseLayer = {
            ...layerData,
            isEditable: true,
            isOfflineAvailable: false,
            isOfflineOn: false
        } as EditableLayer;
        this.ngRedux.dispatch(new AddBaseLayerAction({
            layerData: baseLayer
        }));
        return baseLayer;
    }

    private async addBaseLayerToDatabase(layer: EditableLayer) {
        if (layer.key === ISRAEL_HIKING_MAP ||
            layer.key === ISRAEL_MTB_MAP ||
            layer.key === ESRI ||
            layer.key === SATELLITE) {
            return;
        }
        if (!this.authorizationService.isLoggedIn()) {
            return;
        }
        let layerToStore = { ...layer } as LayerData as IUserLayer;
        layerToStore.isOverlay = false;
        layerToStore.osmUserId = this.authorizationService.getUserInfo().id;
        let response = await this.httpClient.post(Urls.userLayers, layerToStore).toPromise() as IUserLayer;
        layer.id = response.id;
        this.ngRedux.dispatch(new UpdateBaseLayerAction({
            key: layer.key,
            layerData: layer
        }));

    }

    private async updateUserLayerInDatabase(isOverlay: boolean, layer: EditableLayer) {
        if (this.authorizationService.isLoggedIn()) {
            let layerToStore = { ...layer } as LayerData as IUserLayer;
            layerToStore.isOverlay = isOverlay;
            layerToStore.osmUserId = this.authorizationService.getUserInfo().id;
            layerToStore.id = layer.id;
            let response = await this.httpClient.put(Urls.userLayers + layerToStore.id, layerToStore).toPromise() as IUserLayer;
            layer.id = response.id;
        }
    }

    private async deleteUserLayerFromDatabase(id: string) {
        if (this.authorizationService.isLoggedIn()) {
            await this.httpClient.delete(Urls.userLayers + id).toPromise();
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

    private addOverlayFromData(layerData: LayerData, visible: boolean): Overlay {
        let overlay = {
            ...layerData,
            visible,
            isEditable: true,
            isOfflineAvailable: false,
            isOfflineOn: false,
        } as Overlay;
        this.ngRedux.dispatch(new AddOverlayAction({
            layerData: overlay
        }));
        return overlay;
    }

    private async addOverlayToDatabase(layer: Overlay) {
        if (layer.key === HIKING_TRAILS ||
            layer.key === BICYCLE_TRAILS) {
            return;
        }
        if (!this.authorizationService.isLoggedIn()) {
            return;
        }
        let layerToStore = { ...layer } as LayerData as IUserLayer;
        layerToStore.isOverlay = true;
        layerToStore.osmUserId = this.authorizationService.getUserInfo().id;
        let response = await this.httpClient.post(Urls.userLayers, layerToStore).toPromise() as IUserLayer;
        layer.id = response.id;
        if (layerToStore.isOverlay) {
            this.ngRedux.dispatch(new UpdateOverlayAction({
                key: layer.key,
                layerData: layer
            }));
        }
    }

    public isNameAvailable(key: string, newName: string, isOverlay: boolean): boolean {
        let layers: EditableLayer[] = isOverlay ? this.overlays : this.baseLayers;
        if (newName === key) {
            return true;
        }
        if (!newName) {
            return false;
        }
        return layers.find(l => this.compareKeys(l.key, newName)) == null;
    }

    public updateBaseLayer(oldLayer: EditableLayer, newLayer: EditableLayer): void {
        this.ngRedux.dispatch(new UpdateBaseLayerAction({
            key: oldLayer.key,
            layerData: newLayer
        }));
        this.selectBaseLayer(newLayer.key);
        this.updateUserLayerInDatabase(false, newLayer);
    }

    public updateOverlay(oldLayer: Overlay, newLayer: Overlay): void {
        this.ngRedux.dispatch(new UpdateOverlayAction({
            key: oldLayer.key,
            layerData: newLayer
        }));
        this.updateUserLayerInDatabase(true, newLayer);
    }

    public removeBaseLayer(baseLayer: EditableLayer) {
        if (this.compareKeys(baseLayer.key, this.selectedBaseLayerKey)) {
            this.ngRedux.dispatch(new SelectBaseLayerAction({
                key: this.baseLayers[0].key
            }));
        }
        this.ngRedux.dispatch(new RemoveBaseLayerAction({
            key: baseLayer.key
        }));
        this.deleteUserLayerFromDatabase(baseLayer.id);
    }

    public removeOverlay(overlay: Overlay) {
        this.ngRedux.dispatch(new RemoveOverlayAction({
            key: overlay.key
        }));
        this.deleteUserLayerFromDatabase(overlay.id);
    }

    public selectBaseLayer(key: string) {
        this.ngRedux.dispatch(new SelectBaseLayerAction({
            key
        }));
    }

    public toggleOverlay(overlay: Overlay) {
        let newVisibility = !overlay.visible;
        this.ngRedux.dispatch(new UpdateOverlayAction({
            key: overlay.key,
            layerData: {
                ...overlay,
                visible: newVisibility
            }
        }));
        if (newVisibility) {
            if ((overlay.key === HIKING_TRAILS &&
                this.selectedBaseLayerKey === ISRAEL_HIKING_MAP) ||
                (overlay.key === BICYCLE_TRAILS &&
                this.selectedBaseLayerKey === ISRAEL_MTB_MAP)) {
                this.toastService.warning(this.resources.baseLayerAndOverlayAreOverlapping);
            }
        }
    }

    public isAllOverlaysHidden() {
        return this.overlays.filter(o => o.visible).length === 0;
    }

    public hideAllOverlays() {
        let visibleOverlays = this.overlays.filter(o => o.visible);
        for (let overlay of visibleOverlays) {
            this.toggleOverlay(overlay);
        }
    }

    public addExternalBaseLayer(layerData: LayerData) {
        if (layerData == null || (layerData.address === "" && layerData.key === "")) {
            return;
        }
        let baseLayer = this.baseLayers.find((baseLayerToFind) =>
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

    public addExternalOverlays(overlays: LayerData[]) {
        if (!overlays || overlays.length === 0) {
            return;
        }
        for (let overlay of overlays) {
            let addedOverlay = this.addOverlay(overlay);
            if (!addedOverlay.visible) {
                this.toggleOverlay(addedOverlay);
            }
        }
        // hide overlays that are not part of the share:
        for (let overlay of this.overlays) {
            let externalOverlay = overlays.find(o => o.key === overlay.key || o.address === overlay.address);
            if (externalOverlay == null && overlay.visible) {
                this.toggleOverlay(overlay);
            }
        }
    }

    public getData(): DataContainer {
        let container = {
            baseLayer: null,
            overlays: []
        } as DataContainer;

        container.baseLayer = this.getSelectedBaseLayer();
        let visibleOverlays = this.overlays.filter(overlay => overlay.visible);
        for (let overlay of visibleOverlays) {
            container.overlays.push(overlay);
        }
        return container;
    }

    private compareKeys(key1: string, key2: string): boolean {
        return key1.trim().toLowerCase() === key2.trim().toLowerCase();
    }

    public toggleOffline(layer: EditableLayer, isOverlay: boolean) {
        this.ngRedux.dispatch(new ToggleOfflineAction({
            key: layer.key,
            isOverlay
        }));
    }
}
