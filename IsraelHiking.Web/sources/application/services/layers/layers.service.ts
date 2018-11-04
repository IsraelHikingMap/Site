import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { LocalStorage } from "ngx-store";
import { remove } from "lodash";

import { ResourcesService } from "../resources.service";
import { OsmUserService } from "../osm-user.service";
import { ToastService } from "../toast.service";
import { Urls } from "../../urls";
import { DataContainer, LayerData } from "../../models/models";

export interface ILayer extends LayerData {
    isEditable: boolean;
    id: string;
}

export interface IBaseLayer extends ILayer {
    selected: boolean;
}

export interface IOverlay extends ILayer {
    visible: boolean;
}

interface IUserLayer extends LayerData {
    isOverlay: boolean;
    osmUserId: string;
    id: string;
}

@Injectable()
export class LayersService {
    public static readonly MIN_ZOOM = 7;
    public static readonly MAX_NATIVE_ZOOM = 16;
    public static readonly ISRAEL_MTB_MAP = "Israel MTB Map";
    public static readonly ISRAEL_HIKING_MAP = "Israel Hiking Map";
    public static readonly ESRI = "ESRI";

    private static readonly MIN_ESRI_ZOOM = 0;
    private static readonly MAX_ESRI_ZOOM = 16;
    private static readonly HIKING_TRAILS = "Hiking Trails";
    private static readonly BICYCLE_TRAILS = "Bicycle Trails";
    private static readonly ATTRIBUTION = "Tiles © <a href='https://IsraelHiking.osm.org.il' target='_blank'>Israel Hiking</a>, " +
        "<a href='https://creativecommons.org/licenses/by-nc-sa/3.0/' target='_blank'>CC BY-NC-SA 3.0</a>. " +
        "Data by <a href='https://openstreetmap.org' target='_blank'>OpenStreetMap</a> " +
        "under <a href='https://opendatacommons.org/licenses/odbl/summary/' target='_blank'>ODbL</a>. ";
    private static readonly MTB_ATTRIBUTION = LayersService.ATTRIBUTION;
    private static readonly TRAILS_ATTRIBUTION = "Trail " + LayersService.ATTRIBUTION;
    private static readonly ESRI_ADDRESS =
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    private static readonly ESRI_ATTRIBUTION = "DigitalGlobe, GeoEye, i-cubed, USDA, USGS, AEX, Getmapping, " +
        "Aerogrid, IGN, IGP, swisstopo, and the GIS User Community";
    private static BASE_LAYERS_KEY = "BaseLayers";
    private static OVERLAYS_KEY = "Overlays";
    private static ACTIVE_BASELAYER_KEY = "ActiveBaseLayer";
    private static ACTIVE_OVERLAYS_KEY = "ActiveOverlays";
    private static CUSTOM_LAYER = "Custom Layer";

    @LocalStorage()
    private activeOverlayKeys: string[] = [];
    @LocalStorage()
    private selectedBaseLayerKey: string = LayersService.ISRAEL_HIKING_MAP;

    public baseLayers: IBaseLayer[];
    public overlays: IOverlay[];
    public selectedBaseLayer: IBaseLayer;

    constructor(private readonly resourcesService: ResourcesService,
        private readonly osmUserService: OsmUserService,
        private readonly httpClient: HttpClient,
        private readonly toastService: ToastService
    ) {
        this.selectedBaseLayer = null;
        this.baseLayers = [];
        this.overlays = [];
        this.initializeDefaultLayers();
    }

    private initializeDefaultLayers() {
        this.addBaseLayerFromData({
            key: LayersService.ISRAEL_HIKING_MAP,
            address: this.getTileAddressForCurrentLanguage(Urls.DEFAULT_TILES_ADDRESS),
            isEditable: false
        } as ILayer, LayersService.ATTRIBUTION);

        this.addBaseLayerFromData({
            key: LayersService.ISRAEL_MTB_MAP,
            address: this.getTileAddressForCurrentLanguage(Urls.MTB_TILES_ADDRESS),
            isEditable: false
        } as ILayer, LayersService.MTB_ATTRIBUTION);

        this.addBaseLayerFromData({
            key: LayersService.ESRI,
            address: LayersService.ESRI_ADDRESS,
            isEditable: false,
            minZoom: LayersService.MIN_ESRI_ZOOM,
            maxZoom: LayersService.MAX_ESRI_ZOOM
        } as ILayer, LayersService.ESRI_ATTRIBUTION);

        let hikingTrailsOverlay = this.addOverlayFromData({
            key: LayersService.HIKING_TRAILS,
            address: Urls.baseTilesAddress + Urls.OVERLAY_TILES_ADDRESS,
            minZoom: LayersService.MIN_ZOOM,
            maxZoom: LayersService.MAX_NATIVE_ZOOM
        } as ILayer, LayersService.TRAILS_ATTRIBUTION);
        hikingTrailsOverlay.isEditable = false;

        let bicycleTrailsOverlay = this.addOverlayFromData({
            key: LayersService.BICYCLE_TRAILS,
            address: Urls.baseTilesAddress + Urls.OVERLAY_MTB_ADDRESS,
            minZoom: LayersService.MIN_ZOOM,
            maxZoom: LayersService.MAX_NATIVE_ZOOM
        } as ILayer, LayersService.TRAILS_ATTRIBUTION);
        bicycleTrailsOverlay.isEditable = false;
        this.selectBaseLayerAccordingToStorage(false);
    }

    public addBaseLayer = (layerData: LayerData, attribution?: string, position?: number): IBaseLayer => {
        let layer = this.baseLayers.find((layerToFind) => this.compareKeys(layerToFind.key, layerData.key));
        if (layer != null) {
            return layer; // layer exists
        }
        layer = this.addBaseLayerFromData(layerData, attribution, position);
        this.addUserLayerToStorage(false, layer);
        return layer;
    }

    private getUserLayers = async (): Promise<any> => {
        if (!this.osmUserService.isLoggedIn()) {
            return;
        }
        try {
            let data = await this.httpClient.get(Urls.userLayers).toPromise() as IUserLayer[];
            if (data == null) {
                return;
            }
            for (let layer of data) {
                if (layer.isOverlay) {
                    let existingOverlay = this.overlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layer.key));
                    if (existingOverlay) {
                        continue;
                    }
                    let overlay = this.addOverlayFromData(layer);
                    overlay.isEditable = true;
                } else {
                    let existingBaselayer = this.baseLayers.find((baseLayerToFind) => this.compareKeys(baseLayerToFind.key, layer.key));
                    if (existingBaselayer) {
                        continue;
                    }
                    let baselayer = this.addBaseLayerFromData(layer);
                    baselayer.isEditable = true;
                }
            }
        } catch (error) {
            console.error(error);
        }
    }

    private async addUserLayerToStorage(isOverlay: boolean, layer: ILayer) {
        if (isOverlay === false &&
            (layer.key === LayersService.ISRAEL_HIKING_MAP ||
                layer.key === LayersService.ISRAEL_MTB_MAP ||
                layer.key === LayersService.ESRI)) {
            return;
        }
        if (isOverlay &&
            (layer.key === LayersService.HIKING_TRAILS ||
                layer.key === LayersService.BICYCLE_TRAILS)) {
            return;
        }
        if (this.osmUserService.isLoggedIn()) {
            let layerToStore = this.extractDataFromLayer(layer) as IUserLayer;
            layerToStore.isOverlay = isOverlay;
            layerToStore.osmUserId = this.osmUserService.userId;
            let response = await this.httpClient.post(Urls.userLayers, layerToStore).toPromise() as IUserLayer;
            layer.id = response.id;
        }
    }

    private async updateUserLayerInStorage(isOverlay: boolean, layer: ILayer) {
        if (this.osmUserService.isLoggedIn()) {
            let layerToStore = this.extractDataFromLayer(layer) as IUserLayer;
            layerToStore.isOverlay = isOverlay;
            layerToStore.osmUserId = this.osmUserService.userId;
            layerToStore.id = layer.id;
            let response = await this.httpClient.put(Urls.userLayers + layerToStore.id, layerToStore).toPromise() as IUserLayer;
            layer.id = response.id;
        }
    }

    private async deleteUserLayerInStorage(isOverlay: boolean, layer: ILayer) {
        if (this.osmUserService.isLoggedIn()) {
            let layerToStore = Object.assign({ isOverlay: isOverlay, osmUserId: this.osmUserService.userId }, layer) as IUserLayer;
            await this.httpClient.delete(Urls.userLayers + layerToStore.id).toPromise();
        }
    }

    private addBaseLayerFromData = (layerData: LayerData, attribution?: string, position?: number): IBaseLayer => {
        let layer = { ...layerData } as IBaseLayer;
        if (position !== undefined) {
            this.baseLayers.splice(position, 0, layer);
        } else {
            this.baseLayers.push(layer);
        }
        return layer;
    }

    public addOverlay = (layerData: LayerData, attribution?: string): IOverlay => {
        let overlay = this.overlays.find((overlayToFind) => this.compareKeys(overlayToFind.key, layerData.key));
        if (overlay != null) {
            return overlay; // overlay exists
        }
        overlay = this.addOverlayFromData(layerData, attribution);
        this.addUserLayerToStorage(true, overlay);
        return overlay;
    }

    private addOverlayFromData = (layerData: LayerData, attribution?: string): IOverlay => {
        let overlay = { ...layerData } as IOverlay;
        overlay.visible = false;
        overlay.isEditable = true;
        this.overlays.push(overlay);
        return overlay;
    }

    public isNameAvailable(key: string, newName: string, isOverlay: boolean): boolean {
        let layers: ILayer[] = isOverlay ? this.overlays : this.baseLayers;
        if (newName === key) {
            return true;
        }
        if (!newName) {
            return false;
        }
        return layers.find(l => this.compareKeys(l.key, newName)) == null;
    }

    public updateBaseLayer = (oldLayer: IBaseLayer, newLayer: LayerData): void => {
        let position = this.baseLayers.indexOf(this.baseLayers.find(bl => bl.key === oldLayer.key));
        this.removeBaseLayerNoStore(oldLayer);
        let layer = this.addBaseLayerFromData(newLayer, null, position);
        layer.id = oldLayer.id;
        this.selectBaseLayer(layer);
        this.updateUserLayerInStorage(false, layer);
    }

    public updateOverlay = (oldLayer: IOverlay, newLayer: LayerData): void => {
        this.removeOverlayNoStore(oldLayer);
        let overlay = this.addOverlayFromData(newLayer);
        this.toggleOverlay(overlay);
        overlay.id = oldLayer.id;
        this.updateUserLayerInStorage(true, overlay);
    }

    public removeBaseLayer = (baseLayer: IBaseLayer) => {
        this.removeBaseLayerNoStore(baseLayer);
        this.deleteUserLayerInStorage(false, baseLayer);
    }

    private removeBaseLayerNoStore = (baseLayer: IBaseLayer) => {
        if (this.selectedBaseLayer.key !== baseLayer.key) {
            remove(this.baseLayers, (layer) => baseLayer.key === layer.key);
            return;
        }
        let index = this.baseLayers.indexOf(this.selectedBaseLayer);
        index = (index + 1) % this.baseLayers.length;
        this.selectBaseLayer(this.baseLayers[index]);
        remove(this.baseLayers, (layer) => baseLayer.key === layer.key);
        if (this.baseLayers.length === 0) {
            this.selectedBaseLayer = null;
        }
    }

    public removeOverlay = (overlay: IOverlay) => {
        this.removeOverlayNoStore(overlay);
        this.deleteUserLayerInStorage(true, overlay);
    }

    private removeOverlayNoStore = (overlay: IOverlay) => {
        if (overlay.visible) {
            this.toggleOverlay(overlay);
        }
        remove(this.overlays, (overlayToRemove) => overlayToRemove.key === overlay.key);
    }

    public selectBaseLayer = (baseLayer: IBaseLayer) => {
        if (baseLayer.selected) {
            return;
        }
        let previousLayer = this.selectedBaseLayer;
        let newSelectedLayer = this.baseLayers.find((layer) => layer.key === baseLayer.key);
        newSelectedLayer.selected = true;
        this.selectedBaseLayer = newSelectedLayer;

        this.selectedBaseLayerKey = this.selectedBaseLayer.key;
        if (previousLayer) {
            previousLayer.selected = false;
        }
    }

    public toggleOverlay = (overlay: IOverlay) => {
        let overlayFromArray = this.overlays.find((overlayToFind) => overlayToFind.key === overlay.key);
        overlayFromArray.visible = !overlayFromArray.visible;
        if (overlayFromArray.visible) {
            if (this.activeOverlayKeys.indexOf(overlay.key) === -1) {
                this.activeOverlayKeys.push(overlay.key);
            }
            if ((overlay.key === LayersService.HIKING_TRAILS &&
                this.selectedBaseLayer.key === LayersService.ISRAEL_HIKING_MAP) ||
                (overlay.key === LayersService.BICYCLE_TRAILS &&
                this.selectedBaseLayer.key === LayersService.ISRAEL_MTB_MAP)) {
                this.toastService.warning(this.resourcesService.baseLayerAndOverlayAreOverlapping);
            }
        } else {
            if (this.activeOverlayKeys.indexOf(overlay.key) !== -1) {
                this.activeOverlayKeys = this.activeOverlayKeys.filter((keyToFind) => keyToFind !== overlay.key);
            }
        }
    }

    private selectBaseLayerAccordingToStorage = (updateLocalStorage: boolean) => {
        let baseLayerToActivate = this.baseLayers.find(baseToFind => baseToFind.key === this.selectedBaseLayerKey);
        if (baseLayerToActivate) {
            this.selectBaseLayer(baseLayerToActivate);
        } else {
            if (updateLocalStorage) {
                this.selectBaseLayer(this.baseLayers[0]);
            } else {
                this.selectedBaseLayer = this.baseLayers[0];
                this.baseLayers[0].selected = true;
            }
        }
    }

    public initialize = async () => {
        await this.osmUserService.initialize();
        await this.getUserLayers();

        this.selectBaseLayerAccordingToStorage(true);

        for (let overlayKey of this.activeOverlayKeys) {
            let overlay = this.overlays.find(overlayToFind => overlayToFind.key === overlayKey);
            if (overlay && overlay.visible === false) {
                this.toggleOverlay(overlay);
            }
        }

        // must be after using local storage values.
        this.onLanguageChange();
        this.resourcesService.languageChanged.subscribe(this.onLanguageChange);
        this.osmUserService.loginStatusChanged.subscribe(() => this.getUserLayers());
    }

    public addExternalBaseLayer = (layerData: LayerData) => {
        if (layerData == null || (layerData.address === "" && layerData.key === "")) {
            return;
        }
        let baseLayer = this.baseLayers.find((baseLayerToFind) =>
            baseLayerToFind.address.toLocaleLowerCase() === layerData.address.toLocaleLowerCase() ||
            this.compareKeys(baseLayerToFind.key, layerData.key));
        if (baseLayer != null) {
            this.selectBaseLayer(baseLayer);
            return;
        }
        let key = layerData.key;
        if (key === "") {
            key = LayersService.CUSTOM_LAYER + " ";
            let index = 0;
            let layer: IBaseLayer;
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

        let newLayer = this.addBaseLayer({
            key: key,
            address: layerData.address,
            minZoom: layerData.minZoom,
            maxZoom: layerData.maxZoom,
            isEditable: true
        } as ILayer);
        this.selectBaseLayer(newLayer);
    }

    public addExternalOverlays = (overlays: LayerData[]) => {
        if (!overlays || overlays.length === 0) {
            return;
        }
        for (let overlayIndex = 0; overlayIndex < overlays.length; overlayIndex++) {
            let overlay = this.addOverlay(overlays[overlayIndex]);
            if (overlay.visible === false) {
                this.toggleOverlay(overlay);
            }
        }
    }

    private unique(layers: LayerData[]): LayerData[] {
        let layersMap = {};
        return layers.reverse().filter((layer) => {
            if (layersMap[layer.key.trim().toLowerCase()]) {
                return false;
            }
            layersMap[layer.key.trim().toLowerCase()] = true;
            return true;
        });
    }

    public getData = (): DataContainer => {
        let container = {
            baseLayer: null,
            overlays: []
        } as DataContainer;

        container.baseLayer = this.extractDataFromLayer(this.selectedBaseLayer);
        let visibleOverlays = this.overlays.filter(overlay => overlay.visible);
        for (let overlayIndex = 0; overlayIndex < visibleOverlays.length; overlayIndex++) {
            container.overlays.push(this.extractDataFromLayer(visibleOverlays[overlayIndex]));
        }
        return container;
    }

    private extractDataFromLayer = (layer: ILayer): LayerData => {
        return {
            key: layer.key,
            address: layer.address,
            minZoom: layer.minZoom,
            maxZoom: layer.maxZoom,
            opacity: layer.opacity || 1.0
        } as LayerData;
    }

    private onLanguageChange = () => {
        let ihmLayer = this.baseLayers.find(bl => bl.key === LayersService.ISRAEL_HIKING_MAP);
        this.replaceBaseLayerAddress(ihmLayer,
            this.getTileAddressForCurrentLanguage(Urls.DEFAULT_TILES_ADDRESS),
            LayersService.ATTRIBUTION, 0);
        let mtbLayer = this.baseLayers.find(bl => bl.key === LayersService.ISRAEL_MTB_MAP);
        this.replaceBaseLayerAddress(mtbLayer,
            this.getTileAddressForCurrentLanguage(Urls.MTB_TILES_ADDRESS),
            LayersService.MTB_ATTRIBUTION, 1);
    }

    private replaceBaseLayerAddress = (layer: IBaseLayer, newAddress: string, attribution: string, position: number) => {
        remove(this.baseLayers, (layerToRemove) => layer.key === layerToRemove.key);
        layer.address = newAddress;
        layer.selected = false;
        let newLayer = this.addBaseLayerFromData(layer, attribution, position);
        if (this.selectedBaseLayer != null && this.selectedBaseLayer.key === layer.key) {
            this.selectedBaseLayer = null;
            this.selectBaseLayer(newLayer);
        }
    }

    private compareKeys(key1: string, key2: string): boolean {
        return key1.trim().toLowerCase() === key2.trim().toLowerCase();
    }

    private getTileAddressForCurrentLanguage(addressPostfix: string): string {
        return Urls.baseTilesAddress + this.resourcesService.currentLanguage.tilesFolder + addressPostfix;
    }
}
