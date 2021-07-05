import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { NgProgress } from "@ngx-progressbar/core";
import { uniq, cloneDeep } from "lodash-es";
import { Observable, fromEvent, Subscription } from "rxjs";
import { timeout, throttleTime, skip } from "rxjs/operators";
import { v4 as uuidv4 } from "uuid";
import JSZip from "jszip";
import MiniSearch from "minisearch";

import { ResourcesService } from "./resources.service";
import { HashService, IPoiRouterData } from "./hash.service";
import { WhatsAppService } from "./whatsapp.service";
import { DatabaseService, ImageUrlAndData } from "./database.service";
import { RunningContextService } from "./running-context.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { GeoJsonParser } from "./geojson.parser";
import { MapService } from "./map.service";
import { FileService } from "./file.service";
import { ConnectionService } from "./connection.service";
import { NgRedux, select } from "../reducers/infra/ng-redux.module";
import { AddToPoiQueueAction, RemoveFromPoiQueueAction, SetOfflinePoisLastModifiedDateAction } from "../reducers/offline.reducer";
import { SetCategoriesGroupVisibilityAction, AddCategoryAction } from "../reducers/layers.reducer";
import {
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
    EditablePublicPointData
} from "../models/models";
import { Urls } from "../urls";

export type SimplePointType = "Tap" | "CattleGrid" | "Parking" | "OpenGate" | "ClosedGate" | "Block" | "PicnicSite";

interface IImageItem {
    thumbnail: string;
    imageUrls: string[];
}

interface IUpdatesResponse {
    features: GeoJSON.Feature<GeoJSON.Geometry>[];
    images: IImageItem[];
    lastModified: Date;
}

export interface IPoiSocialLinks {
    poiLink: string;
    facebook: string;
    whatsapp: string;
    waze: string;
}

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

    public poiGeojsonFiltered: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public poisChanged: EventEmitter<void>;

    @select((state: ApplicationState) => state.layersState.categoriesGroups)
    private categoriesGroups: Observable<CategoriesGroup[]>;

    @select((state: ApplicationState) => state.configuration.language)
    private language$: Observable<Language>;

    @select((state: ApplicationState) => state.offlineState.uploadPoiQueue)
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
                private readonly ngRedux: NgRedux<ApplicationState>
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
                    return p.properties.poiId;
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
    }

    public async initialize() {
        this.language$.pipe(skip(1)).subscribe(() => {
            this.poisCache = [];
            this.loggingService.info("[POIs] Language changed, updating pois");
            this.updatePois(this.ngRedux.getState().offlineState.poisLastModifiedDate == null);
        });
        this.categoriesGroups.pipe(skip(1)).subscribe(() => {
            this.loggingService.info("[POIs] Categoris changed, updating pois");
            this.updatePois(this.ngRedux.getState().offlineState.poisLastModifiedDate == null);
        });
        await this.syncCategories();
        this.updatePois(true); // don't wait
        await this.mapService.initializationPromise;
        this.moveEndSubsription = fromEvent(this.mapService.map as any, "moveend")
            .pipe(throttleTime(500, undefined, { trailing: true }))
            .subscribe(() => {
                this.ngZone.run(() => {
                    this.updatePois(true);
                });
            });

        if (this.runningContextService.isCordova) {
            await this.updateOfflinePois();
        }
        this.uploadPoiQueue$.subscribe((items: string[]) => this.handleUploadQueueChanges(items));
        this.connectionService.monitor(false).subscribe(state => {
            this.loggingService.info(`[POIs] Connection status changed to: ${state.hasInternetAccess}`);
            if (state.hasInternetAccess && this.ngRedux.getState().offlineState.uploadPoiQueue.length > 0) {
                this.handleUploadQueueChanges(this.ngRedux.getState().offlineState.uploadPoiQueue);
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
            this.ngRedux.dispatch(new RemoveFromPoiQueueAction({featureId: firstItemId}));
            return;
        }
        try {
            let postAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
            let putAddress = Urls.poi + feature.properties.poiId + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
            let poi = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(feature.properties.poiId)
                ? await this.httpClient.post(postAddress, feature).pipe(timeout(180000)).toPromise() as GeoJSON.Feature
                : await this.httpClient.put(putAddress, feature).pipe(timeout(180000)).toPromise() as GeoJSON.Feature;

            this.loggingService.info(`[POIs] Uploaded successfully a${feature.properties.poiIsSimple ? " simple" : ""} ` +
                `feature with id: ${firstItemId}, ` + "removing from upload queue");
            if (this.runningContextService.isCordova && !feature.properties.poiIsSimple) {
                this.databaseService.storePois([poi]);
            }
            this.databaseService.removePoiFromUploadQueue(firstItemId);
            this.queueIsProcessing = false;
            this.ngRedux.dispatch(new RemoveFromPoiQueueAction({featureId: firstItemId}));
        } catch (ex) {
            this.loggingService.error(`[POIs] Failed to upload feature with id: ${firstItemId}, ${ex.message}`);
            if (ex.name !== "TimeoutError") {
                // No timeout - i.e. error from server - need to remove this feature from queue
                this.queueIsProcessing = false;
                this.ngRedux.dispatch(new RemoveFromPoiQueueAction({featureId: firstItemId}));
            }
        } finally {
            this.queueIsProcessing = false;
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
            this.poisGeojson.features = await this.httpClient.get(Urls.poi, { params })
            .pipe(timeout(10000))
            .toPromise() as GeoJSON.Feature<GeoJSON.Point>[];
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
            let lastModified = this.ngRedux.getState().offlineState.poisLastModifiedDate;
            if (lastModified != null) {
                lastModified = new Date(lastModified); // deserialize from json
            }
            this.loggingService.info(`[POIs] Getting POIs for: ${lastModified ? lastModified.toUTCString() : null} from server`);
            if (lastModified == null || Date.now() - lastModified.getTime() > 1000 * 60 * 60 * 24 * 180) {
                await this.downlodOfflineFileAndUpdateDatabase((value) => this.ngPregress.ref().set(value));
                lastModified = this.ngRedux.getState().offlineState.poisLastModifiedDate;
            }
            if (lastModified == null) {
                return;
            }
            await this.updateOfflinePoisByPaging(lastModified);
        } catch (ex) {
            this.loggingService.warning("[POIs] Unable to sync public pois and categories - using local data: " + ex.message);
        }
        this.loggingService.info("[POIs] Getting POIs for clustering from database");
        await this.rebuildPois();
    }

    private async downlodOfflineFileAndUpdateDatabase(progressCallback: (value: number, text?: string) => void): Promise<void> {
        progressCallback(1, this.resources.downloadingPoisForOfflineUsage);
        let poiIdsToDelete = this.poisGeojson.features.map(f => f.properties.poiId);
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
        this.ngRedux.dispatch(new SetOfflinePoisLastModifiedDateAction({ lastModifiedDate: lastModified }));
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
            let updates = await this.httpClient.get(`${Urls.poiUpdates}${lastModified.toISOString()}/${modifiedUntil.toISOString()}`)
                .pipe(timeout(60000)).toPromise() as IUpdatesResponse;
            this.loggingService.info(`[POIs] Storing POIs for: ${lastModified.toUTCString()} - ${modifiedUntil.toUTCString()},` +
                `got: ${ updates.features.length }`);
            let deletedIds = updates.features.filter(f => f.properties.poiDeleted).map(f => f.properties.poiId);
            do {
                await this.databaseService.storePois(updates.features.splice(0, 500));
            } while (updates.features.length > 0);
            this.databaseService.deletePois(deletedIds);
            let imageAndData = this.imageItemToUrl(updates.images);
            this.loggingService.info(`[POIs] Storing images: ${imageAndData.length}`);
            this.databaseService.storeImages(imageAndData);
            let minDate = new Date(Math.min(new Date(updates.lastModified).getTime(), modifiedUntil.getTime()));
            this.loggingService.info(`[POIs] Updating last modified to: ${minDate}`);
            this.ngRedux.dispatch(new SetOfflinePoisLastModifiedDateAction({ lastModifiedDate: minDate }));
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
            let imagesJson = JSON.parse(await zip.file(imagesFile).async("text") as string) as IImageItem[];
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

    private imageItemToUrl(images: IImageItem[]): ImageUrlAndData[] {
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
        let results = [];
        for (let id of uniq(ids)) {
            let feature = await this.databaseService.getPoiById(id);
            let title = this.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
            let point = {
                description: feature.properties.description,
                title,
                displayName: title,
                icon: feature.properties.poiIcon,
                iconColor: feature.properties.poiIconColor,
                location: this.getLocation(feature)
            } as SearchResultsPointOfInterest;
            results.push(point);
            if (results.length === 10) {
                return results;
            }
        }
        return results;
    }

    private getVisibleCategories(): string[] {
        let visibleCategories = [];
        for (let categoriesGroup of this.ngRedux.getState().layersState.categoriesGroups) {
            visibleCategories.push(...categoriesGroup.categories
                .filter(c => c.visible)
                .map(c => c.name));
        }
        return visibleCategories;
    }

    public async updatePois(fromServer: boolean) {
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
            for (let categoriesGroup of this.ngRedux.getState().layersState.categoriesGroups) {
                let categories = await this.httpClient.get(Urls.poiCategories + categoriesGroup.type)
                    .pipe(timeout(10000)).toPromise() as Category[];
                let visibility = categoriesGroup.visible;
                if (this.runningContextService.isIFrame) {
                    this.ngRedux.dispatch(new SetCategoriesGroupVisibilityAction({
                        groupType: categoriesGroup.type,
                        visible: false
                    }));
                    visibility = false;
                }
                for (let category of categories) {
                    if (categoriesGroup.categories.find(c => c.name === category.name) == null) {
                        category.visible = visibility;
                        this.ngRedux.dispatch(new AddCategoryAction({
                            groupType: categoriesGroup.type,
                            category
                        }));
                    }
                }
            }
        } catch (ex) {
            this.loggingService.warning("[POIs] Unable to sync categories, using local categories");
        }

    }

    public async getSelectableCategories(): Promise<ISelectableCategory[]> {
        let categoriesGroup = this.ngRedux.getState().layersState.categoriesGroups.find(g => g.type === "Points of Interest");
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
        let itemInCache = this.poisCache.find(f => f.properties.poiId === id && f.properties.source === source);
        if (itemInCache) {
            return cloneDeep(itemInCache);
        }
        try {
            let params = new HttpParams()
            .set("language", language || this.resources.getCurrentLanguageCodeSimplified());
            let poi = await this.httpClient.get(Urls.poi + source + "/" + id, { params })
                .pipe(timeout(6000))
                .toPromise() as GeoJSON.Feature;
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

    private async addPointToUploadQueue(feature: GeoJSON.Feature): Promise<void> {
        this.poisCache = [];
        this.loggingService.info(`[POIs] adding POI with id ${feature.properties.poiId} to queue`);
        await this.databaseService.addPoiToUploadQueue(feature);
        this.ngRedux.dispatch(new AddToPoiQueueAction({featureId: feature.properties.poiId}));
    }

    public getPoiSocialLinks(feature: GeoJSON.Feature): IPoiSocialLinks {
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let poiLink = this.hashService.getFullUrlFromPoiId({
            source: feature.properties.poiSource,
            id: feature.properties.identifier,
            language
        } as IPoiRouterData);
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

    public getTitle(feature: GeoJSON.Feature, language: string) {
        if (feature.properties["name:" + language]) {
            return feature.properties["name:" + language];
        }
        if (feature.properties.name) {
            return feature.properties.name;
        }
        return "";
    }

    public getDescription(feature: GeoJSON.Feature, language: string) {
        return feature.properties["description:" + language] || feature.properties.description;
    }

    public getExternalDescription(feature: GeoJSON.Feature, language: string) {
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
        let params = new HttpParams()
            .set("location", location.lat + "," + location.lng)
            .set("source", source)
            .set("language", language);
        let feature = null;
        try {
            feature = await this.httpClient.get(Urls.poiClosest, { params }).pipe(timeout(1000)).toPromise() as GeoJSON.Feature;
        } catch (ex) {
            this.loggingService.warning(`[POIs] Unable to get closest POI: ${ex.message}`);
        }
        if (feature == null) {
            return null;
        }
        let dataContainer = this.geoJsonParser.toDataContainer({
            features: [feature],
            type: "FeatureCollection"
        }, this.resources.getCurrentLanguageCodeSimplified());
        let markerData = dataContainer.routes[0].markers[0];
        return markerData;
    }

    public addSimplePoint(latlng: LatLngAlt, pointType: SimplePointType): Promise<any> {
        let feature = {
            type: "Feature",
            properties: {
                poiIsSimple: true,
                poiType: pointType,
                poiId: uuidv4(),
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
        feature.properties.poiId = uuidv4();
        feature.properties.poiSource = "OSM";
        feature.geometry = {
            type: "Point",
            coordinates: SpatialService.toCoordinate(location)
        };
        return this.addPointToUploadQueue(feature);
    }

    public async updateComplexPoi(info: EditablePublicPointData, newLocation?: LatLngAlt) {
        let originalFeature = this.ngRedux.getState().poiState.selectedPointOfInterest;
        let editableDataBeforeChanges = this.getEditableDataFromFeature(originalFeature);
        let hasChages = false;
        let featureContainingOnlyChanges = {
            type: "Feature",
            geometry: originalFeature.geometry,
            properties: {
                poiId: originalFeature.properties.poiId,
                identifier: originalFeature.properties.identifier,
                poiSource: originalFeature.properties.poiSource
            } as any
        } as GeoJSON.Feature;

        if (this.ngRedux.getState().offlineState.uploadPoiQueue.indexOf(originalFeature.properties.poiId) !== -1) {
            // this is the case where there was a previous update request but this hs not been uploaded to the server yet...
            let featureFromDatabase = await this.databaseService.getPoiFromUploadQueue(originalFeature.properties.poiId);
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
        if (hasChages) {
            await this.addPointToUploadQueue(featureContainingOnlyChanges);
        }
    }

    public getEditableDataFromFeature(feature: GeoJSON.Feature): EditablePublicPointData {
        let language = this.resources.getCurrentLanguageCodeSimplified();
        return {
            id: feature.properties.poiId,
            category: feature.properties.poiCategory,
            description: this.getDescription(feature, language),
            title: this.getTitle(feature, language),
            icon: feature.properties.poiIcon,
            iconColor: feature.properties.poiIconColor,
            imagesUrls: Object.keys(feature.properties).filter(k => k.startsWith("image")).map(k => feature.properties[k]),
            urls: Object.keys(feature.properties).filter(k => k.startsWith("website")).map(k => feature.properties[k]),
            isPoint: feature.geometry.type === "Point" || feature.geometry.type === "MultiPoint",
            lengthInKm: (feature.geometry.type === "LineString" || feature.geometry.type === "MultiLineString")
                ? SpatialService.getLengthInMetersForGeometry(feature.geometry) / 1000.0
                : null
        };
    }

    public getFeatureFromEditableData(info: EditablePublicPointData): GeoJSON.Feature {
        let feature = {
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
}
