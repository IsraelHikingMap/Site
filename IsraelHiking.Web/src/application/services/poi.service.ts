import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { NgProgress } from "ngx-progressbar";
import { uniq, cloneDeep, isEqualWith } from "lodash-es";
import { Observable, fromEvent, Subscription, firstValueFrom } from "rxjs";
import { timeout, throttleTime, skip, filter } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import { Store, Select } from "@ngxs/store";
import JSZip from "jszip";
import MiniSearch from "minisearch";

import { ResourcesService } from "./resources.service";
import { HashService, PoiRouterData, RouteStrings } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { DatabaseService, ImageUrlAndData } from "./database.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GeoJsonParser } from "./geojson.parser";
import { MapService } from "./map.service";
import { FileService } from "./file.service";
import { ConnectionService } from "./connection.service";
import { AddToPoiQueueAction, RemoveFromPoiQueueAction, SetOfflinePoisLastModifiedDateAction } from "../reducers/offline.reducer";
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
    SearchResultsPointOfInterest,
    Contribution,
    NorthEast,
    Language,
    EditablePublicPointData,
    OfflineState
} from "../models/models";

export type SimplePointType = "Tap" | "CattleGrid" | "Parking" | "OpenGate" | "ClosedGate" | "Block" | "PicnicSite";

type ImageItem = {
    thumbnail: string;
    imageUrls: string[];
};

type UpdatesResponse = {
    features: GeoJSON.Feature<GeoJSON.Geometry>[];
    images: ImageItem[];
    lastModified: Date;
};

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
    private poisGeojson: GeoJSON.FeatureCollection<GeoJSON.Point>;
    private miniSearch: MiniSearch;
    private queueIsProcessing: boolean;
    private moveEndSubsription: Subscription;
    private offlineState: OfflineState;

    public poiGeojsonFiltered: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public poisChanged: EventEmitter<void>;

    @Select((state: ApplicationState) => state.layersState.categoriesGroups)
    private categoriesGroups: Observable<CategoriesGroup[]>;

    @Select((state: ApplicationState) => state.configuration.language)
    private language$: Observable<Language>;

    @Select((state: ApplicationState) => state.offlineState.uploadPoiQueue)
    private uploadPoiQueue$: Observable<string[]>;

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
                private readonly fileService: FileService,
                private readonly connectionService: ConnectionService,
                private readonly ngPregress: NgProgress,
                private readonly store: Store
    ) {
        this.poisCache = [];
        this.poisChanged = new EventEmitter();
        this.queueIsProcessing = false;
        this.moveEndSubsription = null;

        this.poiGeojsonFiltered = {
            type: "FeatureCollection",
            features: []
        };

        this.poisGeojson = {
            type: "FeatureCollection",
            features: []
        };
        this.miniSearch = new MiniSearch({
            idField: "poiId",
            extractField: (p: GeoJSON.Feature<GeoJSON.Geometry>, fieldName) => {
                if (fieldName === "poiId") {
                    return this.getFeatureId(p);
                }
                if (p.properties.poiNames[fieldName]) {
                    return p.properties.poiNames[fieldName].join(" ");
                }
                return "";
            },
            fields: ["he", "en"],
            searchOptions: {
                fuzzy: 0.2
            }
        });

        this.store.select((s: ApplicationState) => s.offlineState).subscribe(offlineState => this.offlineState = offlineState);
    }

    public async initialize() {
        this.language$.pipe(skip(1)).subscribe(() => {
            this.poisCache = [];
            this.loggingService.info("[POIs] Language changed, updating pois");
            this.updatePois(this.offlineState.poisLastModifiedDate == null);
        });
        this.categoriesGroups.pipe(skip(1)).subscribe(() => {
            this.loggingService.info("[POIs] Categories changed, updating pois");
            this.updatePois(this.offlineState.poisLastModifiedDate == null);
        });
        await this.syncCategories();
        this.updatePois(true); // don't wait
        await this.mapService.initializationPromise;
        let lastLocation = this.mapService.map.getCenter();
        this.moveEndSubsription = fromEvent(this.mapService.map as any, "moveend")
            .pipe(
                throttleTime(500, undefined, { trailing: true }),
                filter(() => {
                    let lastLocationPoint = this.mapService.map.project(lastLocation);
                    return lastLocationPoint.dist(this.mapService.map.project(this.mapService.map.getCenter())) > 200;
                }),
            ).subscribe(() => {
                lastLocation = this.mapService.map.getCenter();
                this.ngZone.run(() => {
                    this.updatePois(true);
                });
            });

        if (this.runningContextService.isCapacitor) {
            await this.updateOfflinePois();
        }
        this.uploadPoiQueue$.subscribe((items: string[]) => this.handleUploadQueueChanges(items));
        this.connectionService.monitor(false).subscribe(state => {
            this.loggingService.info(`[POIs] Connection status changed to: ${state.hasInternetAccess}`);
            if (state.hasInternetAccess && this.offlineState.uploadPoiQueue.length > 0) {
                this.handleUploadQueueChanges(this.offlineState.uploadPoiQueue);
            }
        });

    }

    private async handleUploadQueueChanges(items: string[]) {
        if (items.length === 0) {
            this.loggingService.info("[POIs] Upload queue changed and now it is empty");
            return;
        }
        if (this.queueIsProcessing) {
            this.loggingService.info("[POIs] Upload queue is currently processing, ignoring changes");
            return;
        }
        this.queueIsProcessing = true;
        let firstItemId = items[0];
        this.loggingService.info(`[POIs] Upload queue changed, items in queue: ${items.length}, first item id: ${firstItemId}`);

        let feature = await this.databaseService.getPoiFromUploadQueue(firstItemId);
        if (feature == null) {
            this.loggingService.info(`[POIs] Upload queue has element which is not in the database, removing item: ${firstItemId}`);
            this.queueIsProcessing = false;
            this.store.dispatch(new RemoveFromPoiQueueAction(firstItemId));
            return;
        }
        try {
            let postAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
            let putAddress = Urls.poi + this.getFeatureId(feature) + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
            let poi$ = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(this.getFeatureId(feature))
                ? this.httpClient.post(postAddress, feature).pipe(timeout(180000))
                : this.httpClient.put(putAddress, feature).pipe(timeout(180000));
            let poi = await firstValueFrom(poi$) as GeoJSON.Feature;
            this.loggingService.info(`[POIs] Uploaded successfully a${feature.properties.poiIsSimple ? " simple" : ""} ` +
                `feature with id: ${firstItemId}, ` + "removing from upload queue");
            if (this.runningContextService.isCapacitor && !feature.properties.poiIsSimple) {
                await this.databaseService.storePois([poi]);
                this.rebuildPois();
            }
            this.databaseService.removePoiFromUploadQueue(firstItemId);
            this.queueIsProcessing = false;
            this.store.dispatch(new RemoveFromPoiQueueAction(firstItemId));
        } catch (ex) {
            this.queueIsProcessing = false;
            let typeAndMessage = this.loggingService.getErrorTypeAndMessage(ex);
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

    private async getPoisFromServer(): Promise<GeoJSON.Feature<GeoJSON.Point>[]> {
        let visibleCategories = this.getVisibleCategories();
        if (this.mapService.map.getZoom() <= 10) {
            return [];
        }
        let bounds = SpatialService.getMapBounds(this.mapService.map);
        // Adding half a screen padding:
        bounds.northEast.lng += (bounds.northEast.lng - bounds.southWest.lng) / 2.0;
        bounds.northEast.lat += (bounds.northEast.lat - bounds.southWest.lat) / 2.0;
        bounds.southWest.lng -= (bounds.northEast.lng - bounds.southWest.lng) / 2.0;
        bounds.southWest.lat -= (bounds.northEast.lat - bounds.southWest.lat) / 2.0;

        let language = this.resources.getCurrentLanguageCodeSimplified();
        let params = new HttpParams()
            .set("northEast", bounds.northEast.lat + "," + bounds.northEast.lng)
            .set("southWest", bounds.southWest.lat + "," + bounds.southWest.lng)
            .set("categories", visibleCategories.join(","))
            .set("language", language);
        try {
            let features$ = this.httpClient.get(Urls.poi, { params }).pipe(timeout(10000));
            this.poisGeojson.features = await firstValueFrom(features$) as GeoJSON.Feature<GeoJSON.Point>[];
            return this.poisGeojson.features;
        } catch {
            return this.poisGeojson.features;
        }
    }

    private getPoisFromMemory(): GeoJSON.Feature<GeoJSON.Point>[] {
        let visibleFeatures = [];
        let visibleCategories = this.getVisibleCategories();
        let language = this.resources.getCurrentLanguageCodeSimplified();
        for (let feature of this.poisGeojson.features) {
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

    private async rebuildPois() {
        this.poisGeojson.features = await this.databaseService.getPoisForClustering();
        if (this.poisGeojson.features.length > 0 && this.moveEndSubsription != null) {
            this.loggingService.info("[POIs] Unsubscribing from move end, pois are from database now");
            this.moveEndSubsription.unsubscribe();
        }
        this.miniSearch.addAllAsync(this.poisGeojson.features);
        this.loggingService.info(`[POIs] Finished getting pois from database and adding to memory: ${this.poisGeojson.features.length}`);
        this.updatePois(false);
    }

    private async updateOfflinePois() {
        try {
            let lastModified = this.offlineState.poisLastModifiedDate;
            if (lastModified != null) {
                lastModified = new Date(lastModified); // deserialize from json
            }
            this.loggingService.info(`[POIs] Getting POIs for: ${lastModified ? lastModified.toUTCString() : null} from server`);
            if (lastModified == null || Date.now() - lastModified.getTime() > 1000 * 60 * 60 * 24 * 180) {
                await this.downlodOfflineFileAndUpdateDatabase((value) => this.ngPregress.ref().set(value));
                lastModified = this.offlineState.poisLastModifiedDate;
            }
            if (lastModified == null) {
                return;
            }
            await this.updateOfflinePoisByPaging(lastModified);
        } catch (ex) {
            this.loggingService.warning("[POIs] Unable to sync public pois and categories - using local data: " + (ex as Error).message);
        }
        this.loggingService.info("[POIs] Getting POIs for clustering from database");
        await this.rebuildPois();
    }

    private async downlodOfflineFileAndUpdateDatabase(progressCallback: (value: number, text?: string) => void): Promise<void> {
        progressCallback(1, this.resources.downloadingPoisForOfflineUsage);
        let poiIdsToDelete = this.poisGeojson.features.map(f => this.getFeatureId(f));
        this.loggingService.info(`[POIs] Deleting exiting pois: ${poiIdsToDelete.length}`);
        await this.databaseService.deletePois(poiIdsToDelete);
        this.loggingService.info("[POIs] Getting cached offline pois file");
        let poisFile = await this.fileService.getFileFromCache(Urls.poisOfflineFile);
        if (poisFile == null) {
            this.loggingService.info("[POIs] No file in cache, downloading pois file");
            await this.fileService.downloadFileToCache(Urls.poisOfflineFile, (value) => progressCallback(value * 50));
            this.loggingService.info("[POIs] Finished downloading pois file, reading file");
            poisFile = await this.fileService.getFileFromCache(Urls.poisOfflineFile);
        }
        this.loggingService.info("[POIs] Opening pois file");
        let lastModified = await this.openPoisFile(poisFile, progressCallback);
        this.loggingService.info(`[POIs] Updating last modified to: ${lastModified}`);
        this.store.dispatch(new SetOfflinePoisLastModifiedDateAction(lastModified));
        this.loggingService.info(`[POIs] Finished downloading file and updating database, last modified: ${lastModified.toUTCString()}`);
        await this.fileService.deleteFileFromCache(Urls.poisOfflineFile);
        this.loggingService.info("[POIs] Finished deleting offline pois cached file");
    }

    private async updateOfflinePoisByPaging(lastModified: Date) {
        let modifiedUntil = lastModified;
        do {
            lastModified = modifiedUntil;
            modifiedUntil = new Date(lastModified.getTime() + 3 * 24 * 60 * 60 * 1000); // last modified + 3 days
            this.loggingService.info(`[POIs] Getting POIs for: ${lastModified.toUTCString()} - ${modifiedUntil.toUTCString()}`);
            let updates$ = this.httpClient.get(`${Urls.poiUpdates}${lastModified.toISOString()}/${modifiedUntil.toISOString()}`)
                .pipe(timeout(60000));
            let updates = await firstValueFrom(updates$) as UpdatesResponse;
            this.loggingService.info(`[POIs] Storing POIs for: ${lastModified.toUTCString()} - ${modifiedUntil.toUTCString()},` +
                `got: ${ updates.features.length }`);
            let deletedIds = updates.features.filter(f => f.properties.poiDeleted).map(f => this.getFeatureId(f));
            do {
                await this.databaseService.storePois(updates.features.splice(0, 500));
            } while (updates.features.length > 0);
            this.databaseService.deletePois(deletedIds);
            let imageAndData = this.imageItemToUrl(updates.images);
            this.loggingService.info(`[POIs] Storing images: ${imageAndData.length}`);
            this.databaseService.storeImages(imageAndData);
            let minDate = new Date(Math.min(new Date(updates.lastModified).getTime(), modifiedUntil.getTime()));
            this.loggingService.info(`[POIs] Updating last modified to: ${minDate}`);
            this.store.dispatch(new SetOfflinePoisLastModifiedDateAction(minDate));
        } while (modifiedUntil < new Date());
    }

    public async openPoisFile(blob: Blob, progressCallback: (percentage: number, text?: string) => void): Promise<Date> {
        let zip = new JSZip();
        await zip.loadAsync(blob);
        await this.writeImages(zip, progressCallback);
        this.loggingService.info("[POIs] Finished saving images to database");
        return await this.writePois(zip, progressCallback);
    }

    private async writePois(zip: JSZip, progressCallback: (percentage: number, content: string) => void): Promise<Date> {
        let lastModified = new Date(0);
        let poisFileNames = Object.keys(zip.files).filter(name => name.startsWith("pois/") && name.endsWith(".geojson"));
        for (let poiFileIndex = 0; poiFileIndex < poisFileNames.length; poiFileIndex++) {
            let poisFileName = poisFileNames[poiFileIndex];
            let poisJson = JSON.parse((await zip.file(poisFileName).async("text")).trim()) as GeoJSON.FeatureCollection;
            let chunkLastModified = this.getLastModifiedFromFeatures(poisJson.features);
            if (chunkLastModified > lastModified) {
                lastModified = chunkLastModified;
            }
            await this.databaseService.storePois(poisJson.features);
            progressCallback(((poiFileIndex + 1) * 10.0 / poisFileNames.length) + 90, this.resources.downloadingPoisForOfflineUsage);
            this.loggingService.debug(`[POIs] Stored pois ${poisFileName} ${poiFileIndex}/${poisFileNames.length}`);
        }
        return lastModified;
    }

    private async writeImages(zip: JSZip, progressCallback: (percentage: number, content: string) => void) {
        let imagesFileNames = Object.keys(zip.files).filter(name => name.startsWith("images/") && name.endsWith(".json"));
        for (let imagesFileIndex = 0; imagesFileIndex < imagesFileNames.length; imagesFileIndex++) {
            let imagesFile = imagesFileNames[imagesFileIndex];
            let imagesJson = JSON.parse(await zip.file(imagesFile).async("text") as string) as ImageItem[];
            let imagesUrl = this.imageItemToUrl(imagesJson);
            await this.databaseService.storeImages(imagesUrl);
            progressCallback((imagesFileIndex + 1) * 40.0 / imagesFileNames.length + 50, this.resources.downloadingPoisForOfflineUsage);
            this.loggingService.debug(`[POIs] Stored images ${imagesFile} ${imagesFileIndex}/${imagesFileNames.length}`);
        }
    }

    private getLastModifiedFromFeatures(features: GeoJSON.Feature[]): Date {
        let lastModified = null;
        for (let feature of features) {
            let dateValue = new Date(feature.properties.poiLastModified);
            if (lastModified == null || dateValue > lastModified) {
                lastModified = dateValue;
            }
        }
        return lastModified;
    }

    private imageItemToUrl(images: ImageItem[]): ImageUrlAndData[] {
        let imageAndData = [] as ImageUrlAndData[];
        for (let image of images) {
            for (let imageUrl of image.imageUrls) {
                imageAndData.push({ imageUrl, data: image.thumbnail });
            }
        }
        return imageAndData;
    }

    public async getSerchResults(searchTerm: string): Promise<SearchResultsPointOfInterest[]> {
        let ids = this.miniSearch.search(searchTerm).map(r => r.id);
        let results = [] as SearchResultsPointOfInterest[];
        for (let id of uniq(ids)) {
            let feature = await this.databaseService.getPoiById(id);
            let title = this.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
            let point = {
                description: feature.properties.description,
                title,
                displayName: title,
                icon: feature.properties.poiIcon,
                iconColor: feature.properties.poiIconColor,
                location: this.getLocation(feature),
                source: feature.properties.poiSource,
                id: feature.properties.identifier
            };
            results.push(point);
            if (results.length === 10) {
                return results;
            }
        }
        return results;
    }

    private getVisibleCategories(): string[] {
        let visibleCategories = [];
        let layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        for (let categoriesGroup of layersState.categoriesGroups) {
            visibleCategories.push(...categoriesGroup.categories
                .filter(c => c.visible)
                .map(c => c.name));
        }
        return visibleCategories;
    }

    private async updatePois(fromServer: boolean) {
        await this.mapService.initializationPromise;
        let visibleCategories = this.getVisibleCategories();
        if (visibleCategories.length === 0) {
            this.poiGeojsonFiltered = {
                type: "FeatureCollection",
                features: []
            };
            this.poisChanged.next();
            return;
        }
        let visibleFeatures = fromServer ? await this.getPoisFromServer() : this.getPoisFromMemory();
        this.poiGeojsonFiltered = {
            type: "FeatureCollection",
            features: visibleFeatures
        };
        this.poisChanged.next();
    }

    public async syncCategories(): Promise<void> {
        try {
            let layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
            for (let categoriesGroup of layersState.categoriesGroups) {
                let categories$ = this.httpClient.get(Urls.poiCategories + categoriesGroup.type).pipe(timeout(10000));
                let categories = await firstValueFrom(categories$) as Category[];
                let visibility = categoriesGroup.visible;
                if (this.runningContextService.isIFrame) {
                    this.store.dispatch(new SetCategoriesGroupVisibilityAction(categoriesGroup.type, false));
                    visibility = false;
                }
                for (let category of categories) {
                    category.visible = visibility;
                    let exsitingCategory = categoriesGroup.categories.find(c => c.name === category.name);
                    if (exsitingCategory == null) {
                        this.store.dispatch(new AddCategoryAction(categoriesGroup.type, category));
                    } else if (!isEqualWith(category, exsitingCategory, (_v1, _v2, key) => key === "visible" ? true : undefined)) {
                        this.store.dispatch(new UpdateCategoryAction(categoriesGroup.type, category));
                    }
                }
                for (let exsitingCategory of categoriesGroup.categories) {
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
        let layersState = this.store.selectSnapshot((s: ApplicationState) => s.layersState);
        let categoriesGroup = layersState.categoriesGroups.find(g => g.type === "Points of Interest");
        let selectableCategories = [] as ISelectableCategory[];
        for (let category of categoriesGroup.categories) {
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
        let itemInCache = this.poisCache.find(f => this.getFeatureId(f) === id && f.properties.source === source);
        if (itemInCache) {
            return cloneDeep(itemInCache);
        }
        if (source === RouteStrings.COORDINATES) {
            return this.getFeatureFromCoordinatesId(id, language);
        }
        try {
            let params = new HttpParams().set("language", language || this.resources.getCurrentLanguageCodeSimplified());
            let poi$ = this.httpClient.get(Urls.poi + source + "/" + id, { params }).pipe(timeout(6000));
            let poi = await firstValueFrom(poi$) as GeoJSON.Feature;
            this.poisCache.splice(0, 0, poi);
            return cloneDeep(poi);
        } catch {
            let feature = await this.databaseService.getPoiById(`${source}_${id}`);
            if (feature == null) {
                throw new Error("Failed to load POI from offline database.");
            }
            this.poisCache.splice(0, 0, feature);
            return feature;
        }
    }

    public getLatLngFromId(id: string): LatLngAlt {
        let split = id.split("_");
        return { lat: +split[0], lng: +split[1] };
    }

    public getFeatureFromCoordinatesId(id: string, language: string): GeoJSON.Feature {
        let latlng = this.getLatLngFromId(id);
        let feature = {
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
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let poiLink = this.hashService.getFullUrlFromPoiId({
            source: feature.properties.poiSource,
            id: feature.properties.identifier,
            language
        } as PoiRouterData);
        let escaped = encodeURIComponent(poiLink);
        let location = this.getLocation(feature);
        return {
            poiLink,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsappService.getUrl(this.getTitle(feature, language), escaped) as string,
            waze: `${Urls.waze}${location.lat},${location.lng}`
        };
    }

    public mergeWithPoi(feature: GeoJSON.Feature, markerData: MarkerData) {
        let language = this.resources.getCurrentLanguageCodeSimplified();
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

    public getTitle(feature: GeoJSON.Feature, language: string): string {
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

    public getDescription(feature: GeoJSON.Feature, language: string): string {
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
            let feature$ = this.httpClient.get(Urls.poiClosest, { params: {
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
        let id = uuidv4();
        let feature = {
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
        let feature = this.getFeatureFromEditableData(info);
        this.setLocation(feature, location);
        let id = uuidv4();
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
        let originalFeature = this.store.selectSnapshot((s: ApplicationState) => s.poiState).selectedPointOfInterest;
        let editableDataBeforeChanges = this.getEditableDataFromFeature(originalFeature);
        let hasChages = false;
        let originalId = this.getFeatureId(originalFeature);
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
            let featureFromDatabase = await this.databaseService.getPoiFromUploadQueue(originalId);
            if (featureFromDatabase != null) {
                featureContainingOnlyChanges = featureFromDatabase;
                hasChages = true;
            }
        }

        if (newLocation) {
            this.setLocation(featureContainingOnlyChanges, newLocation);
            hasChages = true;
        }
        let language = this.resources.getCurrentLanguageCodeSimplified();
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
        let addedImages = info.imagesUrls.filter(u => u && !editableDataBeforeChanges.imagesUrls.includes(u));
        if (addedImages.length > 0) {
            featureContainingOnlyChanges.properties.poiAddedImages = addedImages;
            hasChages = true;
        }
        let removedImages = editableDataBeforeChanges.imagesUrls.filter(u => u && !info.imagesUrls.includes(u));
        if (removedImages.length > 0) {
            featureContainingOnlyChanges.properties.poiRemovedImages = removedImages;
            hasChages = true;
        }
        let addedUrls = info.urls.filter(u => u && !editableDataBeforeChanges.urls.includes(u));
        if (addedUrls.length > 0) {
            featureContainingOnlyChanges.properties.poiAddedUrls = addedUrls;
            hasChages = true;
        }
        let removedUrls = editableDataBeforeChanges.urls.filter(u => u && !info.urls.includes(u));
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

    public getEditableDataFromFeature(feature: GeoJSON.Feature): EditablePublicPointData {
        let language = this.resources.getCurrentLanguageCodeSimplified();
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
        let feature = {
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
        for (let imageUrl of info.imagesUrls) {
            let key = index === 0 ? "image" : `image${index}`;
            feature.properties[key] = imageUrl;
            index++;
        }
        index = 0;
        for (let url of info.urls) {
            let key = index === 0 ? "website" : `website${index}`;
            feature.properties[key] = url;
            index++;
        }
        let language = this.resources.getCurrentLanguageCodeSimplified();
        this.setDescription(feature, info.description, language);
        this.setTitle(feature, info.title, language);
        return feature;
    }

    public getFeatureId(feature: GeoJSON.Feature): string {
        if (feature.id) {
            return feature.id.toString();
        }
        return feature.id ?? feature.properties.poiId;
    }
}
