import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { cloneDeep, isEqualWith } from "lodash-es";
import { Observable, firstValueFrom } from "rxjs";
import { timeout, skip } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import { Store, Select } from "@ngxs/store";
import type { Immutable } from "immer";

import { ResourcesService } from "./resources.service";
import { HashService, PoiRouterData, RouteStrings } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { DatabaseService } from "./database.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GeoJsonParser } from "./geojson.parser";
import { MapService } from "./map.service";
import { ConnectionService } from "./connection.service";
import { AddToPoiQueueAction, RemoveFromPoiQueueAction } from "../reducers/offline.reducer";
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
    CategoriesGroup,
    Contribution,
    NorthEast,
    Language,
    EditablePublicPointData,
    OfflineState
} from "../models/models";

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
    private poisCache: GeoJSON.Feature[];
    private queueIsProcessing: boolean;
    private offlineState: Immutable<OfflineState>;

    public poiGeojsonFiltered: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public poisChanged: EventEmitter<void>;

    @Select((state: ApplicationState) => state.layersState.categoriesGroups)
    private categoriesGroups: Observable<Immutable<CategoriesGroup[]>>;

    @Select((state: ApplicationState) => state.configuration.language)
    private language$: Observable<Immutable<Language>>;

    @Select((state: ApplicationState) => state.offlineState.uploadPoiQueue)
    private uploadPoiQueue$: Observable<Immutable<string[]>>;

    constructor(private readonly resources: ResourcesService,
                private readonly httpClient: HttpClient,
                private readonly ngZone: NgZone,
                private readonly whatsappService: WhatsAppService,
                private readonly hashService: HashService,
                private readonly databaseService: DatabaseService,
                private readonly runningContextService: RunningContextService,
                private readonly geoJsonParser: GeoJsonParser,
                private readonly loggingService: LoggingService,
                private readonly mapService: MapService,
                private readonly connectionService: ConnectionService,
                private readonly store: Store
    ) {
        this.poisCache = [];
        this.poisChanged = new EventEmitter();
        this.queueIsProcessing = false;

        this.poiGeojsonFiltered = {
            type: "FeatureCollection",
            features: []
        };

        this.store.select((s: ApplicationState) => s.offlineState).subscribe(offlineState => this.offlineState = offlineState);
    }

    public async initialize() {
        this.language$.pipe(skip(1)).subscribe(() => {
            this.poisCache = [];
            this.loggingService.info("[POIs] Language changed, updating pois");
            this.updatePois();
        });
        this.categoriesGroups.pipe(skip(1)).subscribe(() => {
            this.loggingService.info("[POIs] Categories changed, updating pois");
            this.updatePois();
        });
        await this.syncCategories();
        await this.mapService.initializationPromise;
        this.uploadPoiQueue$.subscribe((items: Immutable<string[]>) => this.handleUploadQueueChanges(items));
        this.connectionService.stateChanged.subscribe(online => {
            this.loggingService.info(`[POIs] Connection status changed to: ${online}`);
            if (online && this.offlineState.uploadPoiQueue.length > 0) {
                this.handleUploadQueueChanges(this.offlineState.uploadPoiQueue);
            }
        });
        // HM TODO: offline needs special handling here
        this.mapService.map.addSource("points-of-interest", {
            type: "vector",
            url: "https://israelhiking.osm.org.il/vector/data/pois.json",
        });
        // HM TODO: check if there's a need to add more layers to support more source layers.
        this.mapService.map.addLayer({
            id: "points-of-interest-layer",
            type: "circle",
            source: "points-of-interest",
            "source-layer": "poi",
            paint: {
                "circle-color": "transparent",
            }
        });
        this.mapService.map.on("sourcedata", (e) => {
            if (e.sourceId === "points-of-interest") {
                this.ngZone.run(() => {
                    this.updatePois();
                });
            }
        });
        this.mapService.map.on("moveend", (e) => {
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
                ? this.httpClient.post(postAddress, feature).pipe(timeout(180000))
                : this.httpClient.put(putAddress, feature).pipe(timeout(180000));
            const poi = await firstValueFrom(poi$) as GeoJSON.Feature;
            if (feature.properties.poiIsSimple) {
                this.loggingService.info("[POIs] Uploaded successfully a simple feature with generated id: " +
                `${firstItemId} at: ${JSON.stringify(this.getLocation(feature))}, removing from upload queue`);
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

    private setIconColorCategory(feature: GeoJSON.Feature, poi: GeoJSON.Feature<GeoJSON.Point>) {
        switch (feature.properties.sub_class) {
            case "spring":
            case "pond":
            case "reservoir":
                poi.properties.poiIconColor = "blue";
                poi.properties.poiIcon = "icon-tint";
                poi.properties.poiCategory = "Water";
                break;
            case "waterfall":
                poi.properties.poiIconColor = "blue";
                poi.properties.poiIcon = "icon-waterfall";
                poi.properties.poiCategory = "Water";
                break;
            case "waterhole":
                poi.properties.poiIconColor = "blue";
                poi.properties.poiIcon = "icon-waterhole";
                poi.properties.poiCategory = "Water";
                break;
            case "water_well":
                poi.properties.poiIconColor = "blue";
                poi.properties.poiIcon = "icon-water-well";
                poi.properties.poiCategory = "Water";
                break;
            case "cistern":
                poi.properties.poiIconColor = "blue";
                poi.properties.poiIcon = "icon-cistern";
                poi.properties.poiCategory = "Water";
                break;
            case "ruins":
                poi.properties.poiIconColor = "#666666";
                poi.properties.poiIcon = "icon-ruins";
                poi.properties.poiCategory = "Historic";
                break;
            case "archaeological_site":
                poi.properties.poiIconColor = "#666666";
                poi.properties.poiIcon = "icon-archaeological";
                poi.properties.poiCategory = "Historic";
                break;
            case "memorial": 
            case "monument":
                poi.properties.poiIconColor = "#666666";
                poi.properties.poiIcon = "icon-memorial";
                poi.properties.poiCategory = "Historic";
                break;
            case "viewpoint":
                poi.properties.poiIconColor = "#008000";
                poi.properties.poiIcon = "icon-viewpoint";
                poi.properties.poiCategory = "Viewpoint";
                break;
            case "picnic_site":
            case "picnic_table":
            case "picnic":
                poi.properties.poiIconColor = "#734a08";
                poi.properties.poiIcon = "icon-picnic";
                poi.properties.poiCategory = "Camping";
                break;
            case "camp_site":
                poi.properties.poiIconColor = "#734a08";
                poi.properties.poiIcon = "icon-campsite";
                poi.properties.poiCategory = "Camping";
                break;
            case "cave_entrance":
            case "tomb":
                poi.properties.poiIconColor = "black";
                poi.properties.poiIcon = "icon-cave";
                poi.properties.poiCategory = "Natural";
                break;
            case "tree":
                poi.properties.poiIconColor = "#008000";
                poi.properties.poiIcon = "icon-tree";
                poi.properties.poiCategory = "Natural";
                break;
            case "flowers":
                poi.properties.poiIconColor = "#008000";
                poi.properties.poiIcon = "icon-flowers";
                poi.properties.poiCategory = "Natural";
                break;
            case "attraction":
                poi.properties.poiIconColor = "#ffb800";
                poi.properties.poiIcon = "icon-star";
                poi.properties.poiCategory = "Other";
                break;
            case "protected_area":
            case "nature_reserve":
            case "national_park":
                poi.properties.poiIconColor = "#008000";
                poi.properties.poiIcon = "icon-nature-reserve";
                poi.properties.poiCategory = "Other";
                break;
            case "peak":
                poi.properties.poiIconColor = "black";
                poi.properties.poiIcon = "icon-peak";
                poi.properties.poiCategory = "Other";
                break;
            default:
                // HM TODO: decide what to do with these points
                // HM TODO: check if there are more categories that need to be handled
                poi.properties.poiIconColor = "black";
                poi.properties.poiIcon = "icon-search";
                poi.properties.poiCategory = "Other";
        }
    }

    private async getPoisFromTiles(): Promise<GeoJSON.Feature<GeoJSON.Point>[]> {
        if (this.mapService.map.getZoom() <= 10) {
            return [];
        }
        const features = this.mapService.map.querySourceFeatures("points-of-interest", {sourceLayer: "poi"});
        const pois = features.map(feature => {
            // HM TODO: handle other geometries?
            let poi: GeoJSON.Feature<GeoJSON.Point> = {
                type: "Feature",
                geometry: feature.geometry as GeoJSON.Point,
                properties: JSON.parse(JSON.stringify(feature.properties)) || {}
            };
            let osmType = feature.id.toString().endsWith("1") ? "node_" : feature.id.toString().endsWith("2") ? "way_" : "relation_";
            poi.properties.identifier = osmType + Math.floor((Number(feature.id)/ 10));
            poi.properties.poiSource = "OSM";
            poi.properties.poiId = "OSM_" + poi.properties.identifier;
            //feature.properties.poiGeolocation = JSON.parse(feature.properties.poiGeolocation);
            //feature.properties.poiNames = JSON.parse(feature.properties.poiNames);
            this.setIconColorCategory(feature, poi);
            poi.properties.poiLanguage = "all";
            poi.properties.poiGeolocation = {
                lat: poi.geometry.coordinates[1],
                lng: poi.geometry.coordinates[0],
            };
            return poi;
        });
        return this.filterFeatures(pois);
    }

    private filterFeatures(features: GeoJSON.Feature<GeoJSON.Point>[]): GeoJSON.Feature<GeoJSON.Point>[] {
        const visibleFeatures = [];
        const visibleCategories = this.getVisibleCategories();
        const language = this.resources.getCurrentLanguageCodeSimplified();
        for (const feature of features) {
            if (feature.properties.poiLanguage !== "all" && feature.properties.poiLanguage !== language) {
                continue;
            }
            if (visibleCategories.indexOf(feature.properties.poiCategory) === -1) {
                continue;
            }
            if (this.getTitle(feature, language) || this.hasExtraData(feature, language)) {
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
                const categories$ = this.httpClient.get(Urls.poiCategories + categoriesGroup.type).pipe(timeout(10000));
                const categories = await firstValueFrom(categories$) as Category[];
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
        } catch (ex) {
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
                    .filter(i => i.iconColorCategory.icon !== "icon-nature-reserve")
                    .map(i => i.iconColorCategory)
            } as ISelectableCategory);
        }
        return selectableCategories;
    }

    public async getPoint(id: string, source: string, language?: string): Promise<GeoJSON.Feature> {
        const itemInCache = this.poisCache.find(f => this.getFeatureId(f) === id && f.properties.source === source);
        if (itemInCache) {
            return cloneDeep(itemInCache);
        }
        if (source === RouteStrings.COORDINATES) {
            return this.getFeatureFromCoordinatesId(id, language);
        }
        const params = new HttpParams().set("language", language || this.resources.getCurrentLanguageCodeSimplified());
        const poi$ = this.httpClient.get(Urls.poi + source + "/" + id, { params }).pipe(timeout(6000));
        const poi = await firstValueFrom(poi$) as GeoJSON.Feature;
        this.poisCache.splice(0, 0, poi);
        return cloneDeep(poi);
        // HM TODO: get POI from source.
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
        this.setLocation(feature, latlng);
        this.setTitle(feature, id, language);
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
        } as PoiRouterData);
        const escaped = encodeURIComponent(poiLink);
        const location = this.getLocation(feature);
        return {
            poiLink,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsappService.getUrl(this.getTitle(feature, language), escaped) as string,
            waze: `${Urls.waze}${location.lat},${location.lng}`
        };
    }

    public mergeWithPoi(feature: GeoJSON.Feature, markerData: Immutable<MarkerData>) {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        this.setTitle(feature, feature.properties["name:" + language] || markerData.title, language);
        this.setDescription(feature, feature.properties["description:" + language] || markerData.description, language);
        this.setLocation(feature, markerData.latlng);
        feature.properties.poiIcon = feature.properties.poiIcon || `icon-${markerData.type || "star"}`;
        let lastIndex = Math.max(-1, ...Object.keys(feature.properties)
            .filter(k => k.startsWith("image"))
            .map(k => +k.replace("image", "")));
        markerData.urls.filter(u => u.mimeType.startsWith("image")).map(u => u.url).forEach(url => {
            let name = "image" + ++lastIndex;
            if (name === "image0") {
                name = "image";
            }
            feature.properties[name] = url;
        });
        return feature;
    }

    public setDescription(feature: GeoJSON.Feature, value: string, language: string) {
        feature.properties["description:" + language] = value;
    }

    public setTitle(feature: GeoJSON.Feature, value: string, language: string) {
        feature.properties["name:" + language] = value;
    }

    public setLocation(feature: GeoJSON.Feature, value: LatLngAlt) {
        feature.properties.poiGeolocation = {
            lat: value.lat,
            lon: value.lng
        };
    }

    public getTitle(feature: Immutable<GeoJSON.Feature>, language: string): string {
        if (feature.properties["name:" + language]) {
            return feature.properties["name:" + language];
        }
        if (feature.properties.name) {
            return feature.properties.name;
        }
        if (feature.properties["mtb:name:"+ language]) {
            return feature.properties["mtb:name:"+ language];
        }
        if (feature.properties["mtb:name"]) {
            return feature.properties["mtb:name"];
        }
        return "";
    }

    public getDescription(feature: Immutable<GeoJSON.Feature>, language: string): string {
        return feature.properties["description:" + language] || feature.properties.description;
    }

    public getExternalDescription(feature: GeoJSON.Feature, language: string): string {
        return feature.properties["poiExternalDescription:" + language] || feature.properties.poiExternalDescription;
    }

    public getLocation(feature: GeoJSON.Feature): LatLngAlt {
        return {
            lat: feature.properties.poiGeolocation.lat,
            lng: feature.properties.poiGeolocation.lon,
            alt: feature.properties.poiAlt
        };
    }

    public getContribution(feature: GeoJSON.Feature): Contribution {
        return {
            lastModifiedDate: new Date(feature.properties.poiLastModified),
            userAddress: feature.properties.poiUserAddress,
            userName: feature.properties.poiUserName
        } as Contribution;
    }

    public getItmCoordinates(feature: GeoJSON.Feature): NorthEast {
        return {
            east: feature.properties.poiItmEast,
            north: feature.properties.poiItmNorth,
        } as NorthEast;
    }

    public hasExtraData(feature: GeoJSON.Feature, language: string): boolean {
        return feature.properties["description:" + language] || Object.keys(feature.properties).find(k => k.startsWith("image")) != null;
    }

    public async getClosestPoint(location: LatLngAlt, source?: string, language?: string): Promise<MarkerData> {
        let feature = null;
        try {
            const feature$ = this.httpClient.get(Urls.poiClosest, { params: {
                location: location.lat + "," + location.lng,
                source,
                language
            }}).pipe(timeout(1000));
            feature = await firstValueFrom(feature$) as GeoJSON.Feature<GeoJSON.Point>;
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
        this.setLocation(feature, latlng);
        return this.addPointToUploadQueue(feature);
    }

    public addComplexPoi(info: EditablePublicPointData, location: LatLngAlt): Promise<void> {
        const feature = this.getFeatureFromEditableData(info);
        this.setLocation(feature, location);
        const id = uuidv4();
        feature.id = id;
        feature.properties.poiId = id;
        feature.properties.poiSource = "OSM";
        feature.geometry = {
            type: "Point",
            coordinates: SpatialService.toCoordinate(location)
        };
        return this.addPointToUploadQueue(feature);
    }

    public async updateComplexPoi(info: EditablePublicPointData, newLocation?: LatLngAlt) {
        const originalFeature = this.store.selectSnapshot((s: ApplicationState) => s.poiState).selectedPointOfInterest;
        const editableDataBeforeChanges = this.getEditableDataFromFeature(originalFeature);
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

        if (newLocation) {
            this.setLocation(featureContainingOnlyChanges, newLocation);
            hasChages = true;
        }
        const language = this.resources.getCurrentLanguageCodeSimplified();
        if (info.title !== editableDataBeforeChanges.title) {
            this.setTitle(featureContainingOnlyChanges, info.title, language);
            hasChages = true;
        }
        if (info.description !== editableDataBeforeChanges.description) {
            this.setDescription(featureContainingOnlyChanges, info.description, language);
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

    public getEditableDataFromFeature(feature: Immutable<GeoJSON.Feature>): EditablePublicPointData {
        const language = this.resources.getCurrentLanguageCodeSimplified();
        return {
            id: this.getFeatureId(feature),
            category: feature.properties.poiCategory,
            description: this.getDescription(feature, language),
            title: this.getTitle(feature, language),
            icon: feature.properties.poiIcon,
            iconColor: feature.properties.poiIconColor,
            imagesUrls: Object.keys(feature.properties).filter(k => k.startsWith("image")).map(k => feature.properties[k]),
            urls: Object.keys(feature.properties).filter(k => k.startsWith("website")).map(k => feature.properties[k]),
            isPoint: feature.geometry.type === "Point" || feature.geometry.type === "MultiPoint",
            canEditTitle: !feature.properties.poiMerged && !feature.properties["mtb:name"],
            lengthInKm: (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString")
                ? SpatialService.getLengthInMetersForGeometry(feature.geometry) / 1000.0
                : null
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
        let index = 0;
        for (const imageUrl of info.imagesUrls) {
            const key = index === 0 ? "image" : `image${index}`;
            feature.properties[key] = imageUrl;
            index++;
        }
        index = 0;
        for (const url of info.urls) {
            const key = index === 0 ? "website" : `website${index}`;
            feature.properties[key] = url;
            index++;
        }
        const language = this.resources.getCurrentLanguageCodeSimplified();
        this.setDescription(feature, info.description, language);
        this.setTitle(feature, info.title, language);
        return feature;
    }

    public getFeatureId(feature: Immutable<GeoJSON.Feature>): string {
        if (feature.id) {
            return feature.id.toString();
        }
        return feature.id ?? feature.properties.poiId;
    }
}
