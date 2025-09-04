import { Injectable, EventEmitter, NgZone, inject } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { cloneDeep, isEqualWith } from "lodash-es";
import { firstValueFrom } from "rxjs";
import { timeout, skip } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";
import type { GeoJSONFeature } from "maplibre-gl";

import { environment } from "environments/environment";
import { ResourcesService } from "./resources.service";
import { HashService, PoiRouteUrlInfo, RouteStrings } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { DatabaseService } from "./database.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GeoJsonParser } from "./geojson.parser";
import { MapService } from "./map.service";
import { ConnectionService } from "./connection.service";
import { OverpassTurboService } from "./overpass-turbo.service";
import { GeoJSONUtils } from "./geojson-utils";
import { INatureService } from "./inature.service";
import { WikidataService } from "./wikidata.service";
import { ImageAttributionService } from "./image-attribution.service";
import { LatLon, OsmTagsService, PoiProperties } from "./osm-tags.service";
import { AddToPoiQueueAction, RemoveFromPoiQueueAction } from "../reducers/offline.reducer";
import { SetSelectedPoiAction, SetUploadMarkerDataAction } from "../reducers/poi.reducer";
import {
    SetCategoriesGroupVisibilityAction,
    AddCategoryAction,
    UpdateCategoryAction,
    RemoveCategoryAction
} from "../reducers/layers.reducer";
import { Urls } from "../urls";
import type {
    MarkerData,
    LatLngAlt,
    ApplicationState,
    Category,
    IconColorLabel,
    NorthEast,
    EditablePublicPointData,
    OfflineState,
    UpdateablePublicPoiData
} from "../models";


export type SimplePointType = "Tap" | "CattleGrid" | "Parking" | "OpenGate" | "ClosedGate" | "Block" | "PicnicSite"

export type PoiSocialLinks = {
    poiLink: string;
    facebook: string;
    whatsapp: string;
    waze: string;
};

export interface ISelectableCategory extends Category {
    isSelected: boolean;
    selectedIcon: IconColorLabel;
    icons: IconColorLabel[];
    label: string;
}

@Injectable()
export class PoiService {

    private static readonly POIS_SOURCE_LAYER_NAMES = ["global_points", "external"];
    private static readonly POIS_SOURCE_ID = "points-of-interest";
    private static readonly POIS_SOURCE_ADDRESS = environment.baseTilesAddress +  "/vector/data/global_points.json";

    private poisCache: GeoJSON.Feature[] = [];
    private queueIsProcessing: boolean = false;
    private offlineState: Immutable<OfflineState>;

    public poiGeojsonFiltered: GeoJSON.FeatureCollection<GeoJSON.Point, PoiProperties> = {
        type: "FeatureCollection",
        features: []
    };
    public poisChanged = new EventEmitter<void>;

    private readonly resources = inject(ResourcesService);
    private readonly httpClient = inject(HttpClient);
    private readonly ngZone = inject(NgZone);
    private readonly whatsappService = inject(WhatsAppService);
    private readonly hashService = inject(HashService);
    private readonly databaseService = inject(DatabaseService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly geoJsonParser = inject(GeoJsonParser);
    private readonly loggingService = inject(LoggingService);
    private readonly mapService = inject(MapService);
    private readonly connectionService = inject(ConnectionService);
    private readonly iNatureService = inject(INatureService);
    private readonly wikidataService = inject(WikidataService);
    private readonly overpassTurboService = inject(OverpassTurboService);
    private readonly imageAttributinoService = inject(ImageAttributionService);
    private readonly store = inject(Store);

    constructor() {
        this.store.select((s: ApplicationState) => s.offlineState).subscribe(offlineState => this.offlineState = offlineState);
    }

    public async initialize() {
        this.store.select((state: ApplicationState) => state.configuration.language).pipe(skip(1)).subscribe(() => {
            this.poisCache = [];
            this.loggingService.info("[POIs] Language changed, updating pois");
            this.updatePois();
        });
        this.store.select((state: ApplicationState) => state.layersState.categoriesGroups).pipe(skip(1)).subscribe(() => {
            this.loggingService.info("[POIs] Categories changed, updating pois");
            this.updatePois();
        });
        await this.syncCategories();
        await this.mapService.initializationPromise;
        this.store.select((state: ApplicationState) => state.offlineState.uploadPoiQueue).subscribe((items: Immutable<string[]>) => this.handleUploadQueueChanges(items));
        this.connectionService.stateChanged.subscribe(online => {
            this.loggingService.info(`[POIs] Connection status changed to: ${online}`);
            if (online && this.offlineState.uploadPoiQueue.length > 0) {
                this.handleUploadQueueChanges(this.offlineState.uploadPoiQueue);
            }
        });
        this.initializePois();
    }

    private initializePois() {
        this.mapService.map.addSource(PoiService.POIS_SOURCE_ID, {
            type: "vector",
            url: PoiService.POIS_SOURCE_ADDRESS
        });
        for (const sourceLayerName of PoiService.POIS_SOURCE_LAYER_NAMES) {
            this.mapService.map.addLayer({
                id: sourceLayerName + "-layer",
                type: "circle",
                source: PoiService.POIS_SOURCE_ID,
                "source-layer": sourceLayerName,
                paint: {
                    "circle-color": "transparent",
                }
            }, this.resources.endOfBaseLayer);
        }

        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState.downloadedTiles) != null) {
            this.mapService.map.addSource(`${PoiService.POIS_SOURCE_ID}-offline`, {
                type: "vector",
                tiles: [PoiService.POIS_SOURCE_ADDRESS.replace(".json", "/{z}/{x}/{y}.pbf").replace("http://", "slice://")],
                minzoom: 10,
                maxzoom: 14
            });
            for (const sourceLayerName of PoiService.POIS_SOURCE_LAYER_NAMES) {
                this.mapService.map.addLayer({
                    id: `${sourceLayerName}-offline-layer`,
                    type: "circle",
                    source: `${PoiService.POIS_SOURCE_ID}-offline`,
                    "source-layer": sourceLayerName,
                    paint: {
                        "circle-color": "transparent",
                    }
                }, this.resources.endOfBaseLayer);
            }
        }
        this.mapService.map.on("sourcedata", (e) => {
            if (PoiService.POIS_SOURCE_ID === e.sourceId) {
                this.ngZone.run(() => {
                    this.updatePois();
                });
            }
        });
        this.mapService.map.on("moveend", () => {
            this.ngZone.run(() => {
                this.updatePois();
            });
        });
    }

    private async handleUploadQueueChanges(items: Immutable<string[]>) {
        if (items.length === 0) {
            this.loggingService.info("[POIs] Upload queue changed and now it is empty");
            return;
        }
        if (this.queueIsProcessing) {
            this.loggingService.info("[POIs] Upload queue is currently processing, ignoring changes");
            return;
        }
        this.queueIsProcessing = true;
        const firstItemId = items[0];
        this.loggingService.info(`[POIs] Upload queue changed, items in queue: ${items.length}, first item id: ${firstItemId}`);

        const feature = await this.databaseService.getPoiFromUploadQueue(firstItemId);
        if (feature == null) {
            this.loggingService.info(`[POIs] Upload queue has element which is not in the database, removing item: ${firstItemId}`);
            this.queueIsProcessing = false;
            this.store.dispatch(new RemoveFromPoiQueueAction(firstItemId));
            return;
        }
        try {
            const postAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
            const putAddress = Urls.poi + this.getFeatureId(feature) + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
            const poi$ = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.getFeatureId(feature))
                ? this.httpClient.post<GeoJSON.Feature>(postAddress, feature).pipe(timeout(180000))
                : this.httpClient.put<GeoJSON.Feature>(putAddress, feature).pipe(timeout(180000));
            const poi = await firstValueFrom(poi$);
            if (feature.properties.poiIsSimple) {
                this.loggingService.info("[POIs] Uploaded successfully a simple feature with generated id: " +
                `${firstItemId} at: ${JSON.stringify(GeoJSONUtils.getLocation(feature))}, removing from upload queue`);
            } else {
                this.loggingService.info("[POIs] Uploaded successfully a feature with id:" +
                `${this.getFeatureId(poi) ?? firstItemId}, removing from upload queue`);
                this.updatePois();
            }
            this.databaseService.removePoiFromUploadQueue(firstItemId);
            this.queueIsProcessing = false;
            this.store.dispatch(new RemoveFromPoiQueueAction(firstItemId));
        } catch (ex) {
            this.queueIsProcessing = false;
            const typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
            switch (typeAndMessage.type) {
                case "timeout":
                    this.loggingService.error(`[POIs] Failed to upload feature with id: ${firstItemId}, but will try later due to ` +
                        `client side timeout error: ${typeAndMessage.message}`);
                    break;
                case "client":
                    this.loggingService.error(`[POIs] Failed to upload feature with id: ${firstItemId}, but will try later due to ` +
                        `client side general error: ${typeAndMessage.message}`);
                    break;
                default:
                    this.loggingService.error(`[POIs] Failed to upload feature with id: ${firstItemId}, removing from queue due to ` +
                        `server side error: ${typeAndMessage.message}`);
                    // No timeout and not a client side error - i.e. error from server - need to remove this feature from queue
                    this.store.dispatch(new RemoveFromPoiQueueAction(firstItemId));
            }
        }
    }

    private getGeolocation(feature: GeoJSON.Feature): LatLon {
        switch (feature.geometry.type) {
            case "Point":
                return {
                    lat: feature.geometry.coordinates[1],
                    lon: feature.geometry.coordinates[0],
                };
            case "LineString":
                return {
                    lat: feature.geometry.coordinates[0][1],
                    lon: feature.geometry.coordinates[0][0],
                };
            case "Polygon": {
                    const bounds = SpatialService.getBoundsForFeature(feature);
                    return {
                        lat: (bounds.northEast.lat + bounds.southWest.lat) / 2,
                        lon: (bounds.northEast.lng + bounds.southWest.lng) / 2,
                    };
                }
            case "MultiPolygon": {
                const bounds = SpatialService.getBoundsForFeature(feature);
                    return {
                        lat: (bounds.northEast.lat + bounds.southWest.lat) / 2,
                        lon: (bounds.northEast.lng + bounds.southWest.lng) / 2,
                    };
            }
            case "MultiLineString":
                return {
                    lat: feature.geometry.coordinates[0][0][1],
                    lon: feature.geometry.coordinates[0][0][0],
                };
            default:
                throw new Error("Unsupported geometry type: " + feature.geometry.type);
        }
    }

    /**
     * This will adjust the locaiton accorting to the location in the tile 
     * instead of clalculating a different location based on the geometry.
     * This is somewhat of a hack to solve a difference of calculation between 
     * the tile generation and client side calculation.
     * @param id - the id of the poi, for example OSM_way_1234
     * @param poi - the point of interest to adjust
     */
    private adjustGeolocationBasedOnTileData(id: string, poi: GeoJSON.Feature<GeoJSON.Geometry, PoiProperties>) {
        if (poi.geometry.type === "Point") {
            return;
        }
        const feature = this.getFeaturesFromTiles().find(f => this.osmTileFeatureToPoiIdentifier(f) === id);
        if (feature != null) {
            poi.properties.poiGeolocation = this.getGeolocation(feature);    
        }
    }

    private getFeaturesFromTiles(): GeoJSONFeature[] {
        if (this.mapService.map == null) {
            // Map is not ready yet
            return [];
        }
        let features: GeoJSONFeature[] = [];
        for (const sourceLayer of PoiService.POIS_SOURCE_LAYER_NAMES) {
            features = features.concat(this.mapService.map.querySourceFeatures(PoiService.POIS_SOURCE_ID, {sourceLayer}));
        }
        if (features.length === 0) {
            for (const sourceLayer of PoiService.POIS_SOURCE_LAYER_NAMES) {
                features = features.concat(this.mapService.map.querySourceFeatures(`${PoiService.POIS_SOURCE_ID}-offline`, {sourceLayer}));
            }
        }
        return features;
    }

    private getPoisFromTiles(): GeoJSON.Feature<GeoJSON.Point, PoiProperties>[] {
        const features = this.getFeaturesFromTiles();
        const hashSet = new Set();
        let pois = features.map(feature => {
            const poi = this.convertFeatureToPoi(feature, this.osmTileFeatureToPoiIdentifier(feature));
            // convert to point for clustering
            const pointFeature: GeoJSON.Feature<GeoJSON.Point, PoiProperties> = {
                type: "Feature",
                properties: {...poi.properties},
                geometry: {
                    type: "Point",
                    coordinates: [poi.properties.poiGeolocation.lon, poi.properties.poiGeolocation.lat]
                }
            };
            return pointFeature;
        });
        pois = pois.filter(p => {
            if (hashSet.has(p.properties.poiId)) {
                return false;
            }
            hashSet.add(p.properties.poiId);
            return true;
        });
        return this.filterFeatures(pois);
    }

    public osmTileFeatureToPoiIdentifier(feature: GeoJSON.Feature): string {
        if (feature.properties.identifier) {
            return feature.properties.identifier;
        }
        const osmType = feature.id.toString().endsWith("1") ? "node_" : feature.id.toString().endsWith("2") ? "way_" : "relation_";
        return osmType + Math.floor((Number(feature.id)/ 10));
    }

    private poiIdentifierToTypeAndId(id: string): {type: string, osmId: string} {
        const osmTypeAndId = id.split("_");
        return {
            type: osmTypeAndId[0],
            osmId: osmTypeAndId[1]
        };
    }

    private convertFeatureToPoi(feature: GeoJSON.Feature, id: string): GeoJSON.Feature<GeoJSON.Geometry, PoiProperties> {
        const poi: GeoJSON.Feature<GeoJSON.Geometry, PoiProperties> = {
            type: "Feature",
            geometry: feature.geometry,
            properties: JSON.parse(JSON.stringify(feature.properties)) || {}
        };
        poi.properties.identifier = poi.properties.identifier || id;
        poi.properties.poiSource = poi.properties.poiSource || "OSM";
        poi.properties.poiId = poi.properties.poiId || poi.properties.poiSource + "_" + poi.properties.identifier;
        if (typeof poi.properties.poiGeolocation === "string") {
            poi.properties.poiGeolocation = JSON.parse(poi.properties.poiGeolocation);
        }
        poi.properties.poiGeolocation = poi.properties.poiGeolocation || this.getGeolocation(feature);
        OsmTagsService.setIconColorCategory(feature, poi);
        return poi;
    }

    private filterFeatures(features: GeoJSON.Feature<GeoJSON.Point, PoiProperties>[]): GeoJSON.Feature<GeoJSON.Point, PoiProperties>[] {
        const visibleFeatures = [];
        const visibleCategories = this.getVisibleCategories();
        const language = this.resources.getCurrentLanguageCodeSimplified();
        for (const feature of features) {
            if (visibleCategories.indexOf(feature.properties.poiCategory) === -1) {
                continue;
            }
            if (GeoJSONUtils.getTitle(feature, language) || GeoJSONUtils.hasExtraData(feature, language)) {
                visibleFeatures.push(feature);
            }
        }
        return visibleFeatures;
    }

    private getVisibleCategories(): string[] {
        const visibleCategories = [];
        const layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        for (const categoriesGroup of layersState.categoriesGroups) {
            visibleCategories.push(...categoriesGroup.categories
                .filter(c => c.visible)
                .map(c => c.name));
        }
        return visibleCategories;
    }

    private async updatePois() {
        await this.mapService.initializationPromise;
        if (this.getVisibleCategories().length === 0) {
            this.poiGeojsonFiltered = {
                type: "FeatureCollection",
                features: []
            };
            this.poisChanged.next();
            return;
        }
        const visibleFeatures = await this.getPoisFromTiles();
        this.poiGeojsonFiltered = {
            type: "FeatureCollection",
            features: visibleFeatures
        };
        this.poisChanged.next();
    }

    public async syncCategories(): Promise<void> {
        try {
            const layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
            for (const categoriesGroup of layersState.categoriesGroups) {
                const categories = await firstValueFrom(this.httpClient.get<Category[]>(Urls.poiCategories + categoriesGroup.type).pipe(timeout(10000)));
                let visibility = categoriesGroup.visible;
                if (this.runningContextService.isIFrame) {
                    this.store.dispatch(new SetCategoriesGroupVisibilityAction(categoriesGroup.type, false));
                    visibility = false;
                }
                for (const category of categories) {
                    category.visible = visibility;
                    const exsitingCategory = categoriesGroup.categories.find(c => c.name === category.name);
                    if (exsitingCategory == null) {
                        this.store.dispatch(new AddCategoryAction(categoriesGroup.type, category));
                    } else if (!isEqualWith(category, exsitingCategory, (_v1, _v2, key) => key === "visible" ? true : undefined)) {
                        this.store.dispatch(new UpdateCategoryAction(categoriesGroup.type, category));
                    }
                }
                for (const exsitingCategory of categoriesGroup.categories) {
                    if (categories.find(c => c.name === exsitingCategory.name) == null) {
                        this.store.dispatch(new RemoveCategoryAction(categoriesGroup.type, exsitingCategory.name));
                    }
                }
            }
        } catch {
            this.loggingService.warning("[POIs] Unable to sync categories, using local categories");
        }

    }

    public getSelectableCategories(): ISelectableCategory[] {
        const layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        const categoriesGroup = layersState.categoriesGroups.find(g => g.type === "Points of Interest");
        const selectableCategories = [] as ISelectableCategory[];
        for (const category of categoriesGroup.categories) {
            if (category.name === "Wikipedia" || category.name === "iNature") {
                continue;
            }
            selectableCategories.push({
                name: category.name,
                isSelected: false,
                label: category.name,
                icon: category.icon,
                color: category.color,
                icons: category.items
                    .filter(i => i.iconColorCategory.icon !== "icon-leaf")
                    .map(i => i.iconColorCategory)
            } as ISelectableCategory);
        }
        return selectableCategories;
    }

    public async getBasicInfo(id: string, source: string, language?: string): Promise<GeoJSON.Feature> {
        const itemInCache = this.poisCache.find(f => this.getFeatureId(f) === id && f.properties.source === source);
        if (itemInCache) {
            return cloneDeep(itemInCache);
        }
        try {
            switch (source) {
                case "new": {
                    const uploadMarkerData = this.store.selectSnapshot((s: ApplicationState) => s.poiState).uploadMarkerData;
                    const newFeature: GeoJSON.Feature = {
                        id: "",
                        type: "Feature",
                        properties: {
                            poiSource: "OSM",
                            poiId: "",
                            identifier: ""
                        },
                        geometry: {
                            type: "Point",
                            coordinates: SpatialService.toCoordinate(uploadMarkerData.latlng)
                        }
                    };
                    return newFeature;
                }
                case "OSM": {
                    const { osmId, type } = this.poiIdentifierToTypeAndId(id);
                    const feature = await this.overpassTurboService.getFeature(type, osmId);
                    const poi = this.convertFeatureToPoi(feature, id);
                    this.adjustGeolocationBasedOnTileData(id, poi);
                    return poi;
                }
                case "iNature": {
                    const poi = await this.iNatureService.createFeatureFromPageId(id);
                    this.poisCache.splice(0, 0, poi);
                    const clone = cloneDeep(poi);
                    this.store.dispatch(new SetSelectedPoiAction(clone));
                    return clone;
                }
                case "Wikidata": {
                    const poi = await this.wikidataService.createFeatureFromPageId(id, language);
                    this.poisCache.splice(0, 0, poi);
                    const clone = cloneDeep(poi);
                    this.store.dispatch(new SetSelectedPoiAction(clone));
                    return clone;
                }
                case RouteStrings.COORDINATES: {
                    const poi = this.getFeatureFromCoordinatesId(id, language);
                    const clone = cloneDeep(poi);
                    this.store.dispatch(new SetSelectedPoiAction(clone));
                    return clone;
                }
                default: { 
                    const params = new HttpParams().set("language", language || this.resources.getCurrentLanguageCodeSimplified());
                    const poi = await firstValueFrom(this.httpClient.get<GeoJSON.Feature>(Urls.poi + source + "/" + id, { params }).pipe(timeout(6000)));
                    this.poisCache.splice(0, 0, poi);
                    const clone = cloneDeep(poi);
                    this.store.dispatch(new SetSelectedPoiAction(clone));
                    return clone;
                }
            }
        } catch {
            const feature = this.getFeaturesFromTiles().find(f => this.osmTileFeatureToPoiIdentifier(f) === id);
            if (feature == null) {
                throw new Error("Failed to load POI from offline or in-memory tiles.");
            }
            return this.convertFeatureToPoi(feature, id);
        }
    }

    public async updateExtendedInfo(feature: GeoJSON.Feature, language?: string): Promise<GeoJSON.Feature> {
        const { osmId, type } = this.poiIdentifierToTypeAndId(feature.properties.identifier);
        let wikidataPromise = Promise.resolve();
        let inaturePromise = Promise.resolve();
        let placePromise = Promise.resolve(null as GeoJSON.Feature);
        let wayPromise = Promise.resolve(null as GeoJSON.Feature);
        if (feature.properties.wikidata) {
            wikidataPromise = this.wikidataService.enritchFeatureFromWikimedia(feature, language);
        }
        if (feature.properties["ref:IL:inature"]) {
            inaturePromise = this.iNatureService.enritchFeatureFromINature(feature);
        }
        if (type === "node" && feature.properties.place) {
            placePromise = this.overpassTurboService.getPlaceGeometry(osmId);
        }
        if (type === "way" && (feature.properties.highway || feature.properties.waterway)) {
            wayPromise = this.overpassTurboService.getLongWay(osmId, 
                feature.properties["mtb:name"] || feature.properties.name,
                feature.properties.waterway != null,
                feature.properties["mtb:name"] != null);
        }
        try {
            await Promise.all([wikidataPromise, inaturePromise, placePromise, wayPromise]);
            const placeFeature = await placePromise;
            if (placeFeature != null) {
                feature.geometry = placeFeature.geometry;
            }
            const longWayFeature = await wayPromise;
            if (longWayFeature != null) {
                feature.geometry = longWayFeature.geometry;
            }
            this.poisCache.splice(0, 0, feature);
        } catch (ex) {
            this.loggingService.warning(`[POIs] Failed to enrich feature with id: ${feature.properties.poiId}, error: ${(ex as Error).message}`);
        }
        this.store.dispatch(new SetSelectedPoiAction(cloneDeep(feature)));
        return feature;
    }

    public getLatLngFromId(id: string): LatLngAlt {
        const split = id.split("_");
        return { lat: +split[0], lng: +split[1] };
    }

    public getFeatureFromCoordinatesId(id: string, language: string): GeoJSON.Feature {
        const latlng = this.getLatLngFromId(id);
        const feature = {
            type: "Feature",
            id: `${RouteStrings.COORDINATES}_${id}`,
            properties: {
                poiId: `${RouteStrings.COORDINATES}_${id}`,
                identifier: id,
                poiSource: RouteStrings.COORDINATES,
                poiIcon: "icon-globe",
                poiIconColor: "black"
            },
            geometry: {
                type: "Point",
                coordinates: SpatialService.toCoordinate(latlng)
            }
        } as GeoJSON.Feature;
        GeoJSONUtils.setLocation(feature, latlng);
        GeoJSONUtils.setTitle(feature, id, language);
        return feature;
    }

    private async addPointToUploadQueue(feature: GeoJSON.Feature): Promise<void> {
        this.poisCache = [];
        this.loggingService.info(`[POIs] adding POI with id ${this.getFeatureId(feature)} to queue`);
        await this.databaseService.addPoiToUploadQueue(feature);
        this.store.dispatch(new AddToPoiQueueAction(this.getFeatureId(feature)));
    }

    public getPoiSocialLinks(feature: GeoJSON.Feature): PoiSocialLinks {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        const poiLink = this.hashService.getFullUrlFromPoiId({
            source: feature.properties.poiSource,
            id: feature.properties.identifier,
            language
        } as PoiRouteUrlInfo);
        const escaped = encodeURIComponent(poiLink);
        const location = GeoJSONUtils.getLocation(feature);
        return {
            poiLink,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsappService.getUrl(GeoJSONUtils.getTitle(feature, language), escaped) as string,
            waze: `${Urls.waze}${location.lat},${location.lng}`
        };
    }

    private mergeFeatureWithUploadMarker(feature: GeoJSON.Feature, markerData: Immutable<MarkerData>) {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        GeoJSONUtils.setTitle(feature, feature.properties["name:" + language] || markerData.title, language);
        GeoJSONUtils.setDescription(feature, feature.properties["description:" + language] || markerData.description, language);
        GeoJSONUtils.setLocation(feature, markerData.latlng);
        feature.properties.poiIcon = feature.properties.poiIcon || `icon-${markerData.type || "star"}`;
        for (const url of (markerData.urls.filter(u => u.mimeType.startsWith("image")).map(u => u.url))) {
            GeoJSONUtils.setProperty(feature, "image", url);
        };
    }

    public getItmCoordinates(feature: GeoJSON.Feature): NorthEast {
        return {
            east: feature.properties.poiItmEast,
            north: feature.properties.poiItmNorth,
        } as NorthEast;
    }

    public async getClosestPoint(location: LatLngAlt, source: string, language: string): Promise<MarkerData> {
        let feature = null;
        try {
            const feature$ = this.httpClient.get<GeoJSON.Feature<GeoJSON.Point>>(Urls.poiClosest, { params: {
                location: location.lat + "," + location.lng,
                source,
                language
            }}).pipe(timeout(1000));
            feature = await firstValueFrom(feature$);
        } catch (ex) {
            this.loggingService.warning(`[POIs] Unable to get closest POI: ${(ex as Error).message}`);
        }
        if (feature == null) {
            return null;
        }
        return this.geoJsonParser.toMarkerData(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public addSimplePoint(latlng: LatLngAlt, pointType: SimplePointType): Promise<any> {
        const id = uuidv4();
        const feature = {
            id,
            type: "Feature",
            properties: {
                poiIsSimple: true,
                poiType: pointType,
                poiId: id,
                poiSource: "OSM"
            },
            geometry: {
                type: "Point",
                coordinates: SpatialService.toCoordinate(latlng)
            },
        } as GeoJSON.Feature;
        GeoJSONUtils.setLocation(feature, latlng);
        return this.addPointToUploadQueue(feature);
    }

    public addComplexPoi(info: EditablePublicPointData): Promise<void> {
        const feature = this.getFeatureFromEditableData(info);
        GeoJSONUtils.setLocation(feature, info.location);
        const id = uuidv4();
        feature.id = id;
        feature.properties.poiId = id;
        feature.properties.poiSource = "OSM";
        feature.geometry = {
            type: "Point",
            coordinates: SpatialService.toCoordinate(info.location)
        };
        return this.addPointToUploadQueue(feature);
    }

    public async updateComplexPoi(info: EditablePublicPointData, updateLocation: boolean) {
        const originalFeature = info.originalFeature
        const editableDataBeforeChanges = await this.getUpdatableDataFromFeature(originalFeature);
        let hasChages = false;
        const originalId = this.getFeatureId(originalFeature);
        let featureContainingOnlyChanges = {
            id: originalId,
            type: "Feature",
            geometry: originalFeature.geometry,
            properties: {
                poiId: originalId,
                identifier: originalFeature.properties.identifier,
                poiSource: originalFeature.properties.poiSource
            } as any
        } as GeoJSON.Feature;

        if (this.offlineState.uploadPoiQueue.indexOf(originalId) !== -1) {
            // this is the case where there was a previous update request but this hs not been uploaded to the server yet...
            const featureFromDatabase = await this.databaseService.getPoiFromUploadQueue(originalId);
            if (featureFromDatabase != null) {
                featureContainingOnlyChanges = featureFromDatabase;
                hasChages = true;
            }
        }

        if (updateLocation) {
            GeoJSONUtils.setLocation(featureContainingOnlyChanges, info.location);
            hasChages = true;
        }
        const language = this.resources.getCurrentLanguageCodeSimplified();
        if (info.title !== editableDataBeforeChanges.title) {
            GeoJSONUtils.setTitle(featureContainingOnlyChanges, info.title, language);
            hasChages = true;
        }
        if (info.description !== editableDataBeforeChanges.description) {
            GeoJSONUtils.setDescription(featureContainingOnlyChanges, info.description, language);
            hasChages = true;
        }
        if (info.icon !== editableDataBeforeChanges.icon || info.iconColor !== editableDataBeforeChanges.iconColor) {
            featureContainingOnlyChanges.properties.poiIcon = info.icon;
            featureContainingOnlyChanges.properties.poiIconColor = info.iconColor;
            featureContainingOnlyChanges.properties.poiCategory = info.category;
            hasChages = true;
        }
        const addedImages = info.imagesUrls.filter(u => u && !editableDataBeforeChanges.imagesUrls.includes(u));
        if (addedImages.length > 0) {
            featureContainingOnlyChanges.properties.poiAddedImages = addedImages;
            hasChages = true;
        }
        const removedImages = editableDataBeforeChanges.imagesUrls.filter(u => u && !info.imagesUrls.includes(u));
        if (removedImages.length > 0) {
            featureContainingOnlyChanges.properties.poiRemovedImages = removedImages;
            hasChages = true;
        }
        const addedUrls = info.urls.filter(u => u && !editableDataBeforeChanges.urls.includes(u));
        if (addedUrls.length > 0) {
            featureContainingOnlyChanges.properties.poiAddedUrls = addedUrls;
            hasChages = true;
        }
        const removedUrls = editableDataBeforeChanges.urls.filter(u => u && !info.urls.includes(u));
        if (removedUrls.length > 0) {
            featureContainingOnlyChanges.properties.poiRemovedUrls = removedUrls;
            hasChages = true;
        }
        if (!hasChages) {
            this.loggingService.info(`[POIs] No updates were made to feature with id ${originalId}, ` +
                "no need to add to queue");
            return;
        }
        await this.addPointToUploadQueue(featureContainingOnlyChanges);
    }

    public getLengthInKm(feature: Immutable<GeoJSON.Feature>): number | null {
        if (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString") {
            return SpatialService.getLengthInMetersForGeometry(feature.geometry) / 1000.0;
        }
        return null;
    }

    public async getImagesThatHaveAttribution(feature: Immutable<GeoJSON.Feature>) {
        const imagesUrls = GeoJSONUtils.getValidImageUrls(feature);
        const imageAttributions = await Promise.all(imagesUrls.map(u => this.imageAttributinoService.getAttributionForImage(u)));
        return imagesUrls.filter((_, i) => imageAttributions[i] != null);
    }

    public async createEditableDataAndMerge(feature: GeoJSON.Feature): Promise<EditablePublicPointData> {
        const originalFeature = structuredClone(feature);
        const markerData = this.store.selectSnapshot((s: ApplicationState) => s.poiState).uploadMarkerData;
        if (markerData != null) {
            this.mergeFeatureWithUploadMarker(feature, markerData);
            this.store.dispatch(new SetUploadMarkerDataAction(null));
        }
        const data = this.getUpdatableDataFromFeature(feature) as EditablePublicPointData;
        data.originalFeature = originalFeature;
        data.canEditTitle = !feature.properties["mtb:name"];
        data.id = this.getFeatureId(feature);
        data.category = feature.properties.poiCategory;
        data.isPoint = feature.geometry.type === "Point" || feature.geometry.type === "MultiPoint";
        if (feature.geometry.type === "Point" && markerData != null) {
            data.showLocationUpdate = data.id != "";
            data.location = markerData.latlng;
        }
        return data;
    }

    private getUpdatableDataFromFeature(feature: Immutable<GeoJSON.Feature>): UpdateablePublicPoiData {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        return {
            description: GeoJSONUtils.getDescription(feature, language),
            title: GeoJSONUtils.getTitle(feature, language),
            icon: feature.properties.poiIcon,
            iconColor: feature.properties.poiIconColor,
            imagesUrls: GeoJSONUtils.getValidImageUrls(feature),
            urls: GeoJSONUtils.getUrls(feature),
        };
    }

    public getFeatureFromEditableData(info: EditablePublicPointData): GeoJSON.Feature {
        const feature = {
            id: info.id,
            type: "Feature",
            properties: {
                poiId: info.id,
                poiCategory: info.category,
                poiIcon: info.icon,
                poiIconColor: info.iconColor,
            } as any
        } as GeoJSON.Feature;
        for (const imageUrl of info.imagesUrls) {
            GeoJSONUtils.setProperty(feature, "image", imageUrl);
        }
        for (const url of info.urls) {
            GeoJSONUtils.setProperty(feature, "website", url);
        }
        const language = this.resources.getCurrentLanguageCodeSimplified();
        GeoJSONUtils.setDescription(feature, info.description, language);
        GeoJSONUtils.setTitle(feature, info.title, language);
        return feature;
    }

    public getFeatureId(feature: Immutable<GeoJSON.Feature>): string {
        if (feature.id) {
            return feature.id.toString();
        }
        return feature.id ?? feature.properties.poiId;
    }
}
