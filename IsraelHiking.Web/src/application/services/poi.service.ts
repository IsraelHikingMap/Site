import { Injectable, EventEmitter, NgZone } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { uniq } from "lodash-es";
import { Observable, fromEvent } from "rxjs";
import { timeout, throttleTime } from "rxjs/operators";
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
import { ToastService } from "./toast.service";
import { FileService } from "./file.service";
import { NgRedux, select } from "../reducers/infra/ng-redux.module";
import { SetOfflinePoisLastModifiedDateAction } from "../reducers/offline.reducer";
import { SetCategoriesGroupVisibilityAction, AddCategoryAction } from "../reducers/layers.reducer";
import {
    MarkerData,
    LatLngAlt,
    PointOfInterestExtended,
    ApplicationState,
    Category,
    IconColorLabel,
    CategoriesGroup,
    PointOfInterest,
    Language
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
    private poisCache: PointOfInterestExtended[];
    private poisGeojson: GeoJSON.FeatureCollection<GeoJSON.Point>;
    private miniSearch: MiniSearch;

    public poiGeojsonFiltered: GeoJSON.FeatureCollection<GeoJSON.Point>;
    public poisChanged: EventEmitter<void>;

    @select((state: ApplicationState) => state.layersState.categoriesGroups)
    private categoriesGroups: Observable<CategoriesGroup[]>;

    @select((state: ApplicationState) => state.configuration.language)
    private language$: Observable<Language>;

    constructor(private readonly resources: ResourcesService,
                private readonly httpClient: HttpClient,
                private readonly ngZone: NgZone,
                private readonly whatsappService: WhatsAppService,
                private readonly hashService: HashService,
                private readonly databaseService: DatabaseService,
                private readonly runningContextService: RunningContextService,
                private readonly geoJsonParser: GeoJsonParser,
                private readonly loggingService: LoggingService,
                private readonly toastService: ToastService,
                private readonly mapService: MapService,
                private readonly fileService: FileService,
                private readonly ngRedux: NgRedux<ApplicationState>
    ) {
        this.poisCache = [];
        this.poisChanged = new EventEmitter();

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
        this.language$.subscribe(() => {
            this.poisCache = [];
            this.updatePois();
        });
        this.categoriesGroups.subscribe(() => this.updatePois());
        await this.syncCategories();
        if (this.runningContextService.isCordova) {
            await this.rebuildPois();
            await this.updateOfflinePois();
        } else {
            await this.updatePois();
            fromEvent(this.mapService.map, "moveend")
                .pipe(throttleTime(500, undefined, { trailing: true }))
                .subscribe(() => {
                    this.ngZone.run(() => {
                        this.updatePois();
                    });
                });
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
        let pointsOfInterest = await this.httpClient.get(Urls.poi, { params }).pipe(timeout(10000)).toPromise() as PointOfInterest[];
        this.poisGeojson.features = pointsOfInterest.map(p => this.pointToFeature(p));
        return this.poisGeojson.features;
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
            let titles = feature.properties.poiNames[language] || feature.properties.poiNames.all;
            feature.properties.title = (titles && titles.length > 0) ? titles[0] : "";
            feature.properties.hasExtraData = feature.properties.poiHasExtraData[language] || false;
            if (feature.properties.title || feature.properties.hasExtraData) {
                visibleFeatures.push(feature);
            }
        }
        return visibleFeatures;
    }

    private async rebuildPois() {
        this.poisGeojson.features = await this.databaseService.getPoisForClustering();
        this.miniSearch.addAllAsync(this.poisGeojson.features);
        this.updatePois();
    }

    private async updateOfflinePois() {
        try {
            let lastModified = this.ngRedux.getState().offlineState.poisLastModifiedDate;
            if (lastModified != null) {
                lastModified = new Date(lastModified); // deserialize from json
            }
            this.loggingService.info(`[POIs] Getting POIs for: ${lastModified ? lastModified.toUTCString() : null} from server`);
            if (lastModified == null || Date.now() - lastModified.getTime() > 1000 * 60 * 60 * 24 * 180) {
                await this.toastService.progress({
                    action: (progressCallback) => this.downlodOfflineFileAndUpdateDatabase(progressCallback),
                    showContinueButton: true,
                    continueText: this.resources.largeFilesUseWifi
                });
                lastModified = new Date(this.ngRedux.getState().offlineState.poisLastModifiedDate);
            }
            if (lastModified == null) {
                // don't send a request that is too big to the server by mistake
                return;
            }
            await this.updateOfflinePoisByPaging(lastModified);
            this.loggingService.info(`[POIs] Getting POIs for clustering from database`);
            await this.rebuildPois();
        } catch (ex) {
            this.loggingService.warning("[POIs] Unable to sync public pois and categories - using local data: " + ex.message);
        }
    }

    private async downlodOfflineFileAndUpdateDatabase(progressCallback: (value: number, text?: string) => void): Promise<void> {
        progressCallback(1, this.resources.downloadingPoisForOfflineUsage);
        let poiIdsToDelete = this.poisGeojson.features.map(f => f.properties.poiId);
        this.loggingService.info(`[POIs] Deleting exiting pois: ${poiIdsToDelete.length}`);
        await this.databaseService.deletePois(poiIdsToDelete);
        this.loggingService.info(`[POIs] Starting downloading pois file`);
        let poisFile = await this.fileService.getFileContentWithProgress(Urls.poisOfflineFile,
            (value) => progressCallback(1 + value * 49, this.resources.downloadingPoisForOfflineUsage));
        this.loggingService.info(`[POIs] Finished downloading pois file, opening it`);
        let lastModified = await this.openPoisFile(poisFile, progressCallback);
        this.loggingService.info(`[POIs] Updating last modified to: ${lastModified}`);
        this.ngRedux.dispatch(new SetOfflinePoisLastModifiedDateAction({ lastModifiedDate: lastModified }));
        this.loggingService.info(`[POIs] Finished downloading file and updating database, last modified: ${lastModified.toUTCString()}`);
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
        this.loggingService.info(`[POIs] Finished saving images to database`);
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

    public async getSerchResults(searchTerm: string): Promise<PointOfInterestExtended[]> {
        let ids = this.miniSearch.search(searchTerm).map(r => r.id);
        let results = [];
        for (let id of uniq(ids)) {
            let feature = await this.databaseService.getPoiById(id);
            let point = this.featureToPoint(feature);
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

    public async updatePois() {
        await await this.mapService.initializationPromise;
        let visibleCategories = this.getVisibleCategories();
        if (visibleCategories.length === 0) {
            this.poiGeojsonFiltered = {
                type: "FeatureCollection",
                features: []
            };
            this.poisChanged.next();
            return;
        }
        let visibleFeatures = !this.runningContextService.isCordova || this.ngRedux.getState().offlineState.poisLastModifiedDate == null
            ? await this.getPoisFromServer()
            : this.getPoisFromMemory();

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

    public getSelectableCategories = async (): Promise<ISelectableCategory[]> => {
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

    public async getPoint(id: string, source: string, language?: string): Promise<PointOfInterestExtended> {
        let itemInCache = this.poisCache.find(p => p.id === id && p.source === source);
        if (itemInCache) {
            return JSON.parse(JSON.stringify(itemInCache));
        }
        if (!this.runningContextService.isOnline) {
            let feature = await this.databaseService.getPoiById(`${source}_${id}`);
            if (feature == null) {
                throw new Error("Failed to load POI from offline database.");
            }
            let point = this.featureToPoint(feature);
            return point;
        }
        let params = new HttpParams()
            .set("language", language || this.resources.getCurrentLanguageCodeSimplified());
        let poi = await this.httpClient.get(Urls.poi + source + "/" + id, { params }).toPromise() as PointOfInterestExtended;
        this.poisCache.splice(0, 0, poi);
        return JSON.parse(JSON.stringify(poi));
    }

    public async uploadPoint(poiExtended: PointOfInterestExtended): Promise<PointOfInterestExtended> {
        let uploadAddress = Urls.poi + "?language=" + this.resources.getCurrentLanguageCodeSimplified();
        this.poisCache = [];
        let poi = await this.httpClient.post(uploadAddress, poiExtended).toPromise() as PointOfInterestExtended;
        if (this.runningContextService.isCordova) {
            this.databaseService.storePois(poi.featureCollection.features);
        }
        return poi;
    }

    public getPoiSocialLinks(poiExtended: PointOfInterestExtended): IPoiSocialLinks {
        let poiLink = this.hashService.getFullUrlFromPoiId({
            source: poiExtended.source,
            id: poiExtended.id,
            language: this.resources.getCurrentLanguageCodeSimplified()
        } as IPoiRouterData);
        let escaped = encodeURIComponent(poiLink);
        return {
            poiLink,
            facebook: `${Urls.facebook}${escaped}`,
            whatsapp: this.whatsappService.getUrl(poiExtended.title, escaped) as string,
            waze: `${Urls.waze}${poiExtended.location.lat},${poiExtended.location.lng}`
        };
    }

    public mergeWithPoi(poiExtended: PointOfInterestExtended, markerData: MarkerData) {
        poiExtended.title = poiExtended.title || markerData.title;
        poiExtended.description = poiExtended.description || markerData.description;
        poiExtended.location = poiExtended.location || markerData.latlng;
        poiExtended.icon = poiExtended.icon || `icon-${markerData.type || "star"}`;

        markerData.urls.filter(u => u.mimeType.startsWith("image")).map(u => u.url).forEach(url => {
            poiExtended.imagesUrls.push(url);
        });
        return poiExtended;
    }

    public pointToFeature(p: PointOfInterest): GeoJSON.Feature<GeoJSON.Point> {
        let id = p.source + "_" + p.id;
        return {
            type: "Feature",
            properties: {
                poiId: id,
                poiIcon: p.icon,
                poiIconColor: p.iconColor,
                title: p.title,
                hasExtraData: p.hasExtraData,
            },
            id,
            geometry: {
                type: "Point",
                coordinates: [p.location.lng, p.location.lat]
            }
        };
    }

    private featureToPoint(f: GeoJSON.Feature): PointOfInterestExtended {
        let language = this.resources.getCurrentLanguageCodeSimplified();
        let imagesUrls = uniq(Object.keys(f.properties).filter(k => k.toLowerCase().startsWith("image")).map(k => f.properties[k]));
        // HM TODO: remove this?
        // let references = Object.keys(f.properties).filter(k => k.toLowerCase().startsWith("website")).map(k => ({
        //     url: f.properties[k],
        //     sourceImageUrl: f.properties["poiSourceImageUrl" + k.replace("website", "")]
        // }));
        // references = uniqWith(references, (a, b) => a.url === b.url);
        let references = []; // no references due to offline.
        let description = f.properties["description:" + language] || f.properties.description;
        let externalDescription = f.properties["poiExternalDescription:" + language] || f.properties.poiExternalDescription;
        let poi = {
            id: f.properties.identifier,
            category: f.properties.poiCategory,
            hasExtraData: description != null || imagesUrls.length > 0,
            icon: f.properties.poiIcon,
            iconColor: f.properties.poiIconColor,
            location: {
                lat: f.properties.poiGeolocation.lat,
                lng: f.properties.poiGeolocation.lon,
                alt: f.properties.poiAlt
            },
            itmCoordinates: {
                east: f.properties.poiItmEast,
                north: f.properties.poiItmNorth,
            },
            source: f.properties.poiSource,
            isEditable: f.properties.poiSource === "OSM",
            isRoute: f.geometry.type === "LineString" || f.geometry.type === "MultiLineString",
            isArea: f.geometry.type === "Polygon" || f.geometry.type === "MultiPolygon",
            lengthInKm: SpatialService.getLengthInMetersForGeometry(f.geometry) / 1000,
            dataContainer: null,
            featureCollection: {
                type: "FeatureCollection",
                features: [f]
            } as GeoJSON.FeatureCollection,
            references,
            contribution: {
                lastModifiedDate: new Date(f.properties.poiLastModified),
                userAddress: f.properties.poiUserAddress,
                userName: f.properties.poiUserName
            },
            imagesUrls,
            description,
            externalDescription,
            title: Array.isArray(f.properties.poiNames[language]) && f.properties.poiNames[language].length !== 0
                ? f.properties.poiNames[language][0]
                : Array.isArray(f.properties.poiNames.all) && f.properties.poiNames.all.length !== 0
                    ? f.properties.poiNames.all[0]
                    : ""
        };
        if (!poi.title && !poi.hasExtraData) {
            return null;
        }
        return poi;
    }

    public async getClosestPoint(location: LatLngAlt, source?: string, language?: string): Promise<MarkerData> {
        if (!this.runningContextService.isOnline) {
            return null;
        }
        let params = new HttpParams()
            .set("location", location.lat + "," + location.lng)
            .set("source", source)
            .set("language", language);
        let feature = null;
        try {
            feature = await this.httpClient.get(Urls.poiClosest, { params }).pipe(timeout(1000)).toPromise() as GeoJSON.Feature;
        } catch (ex) {
            this.loggingService.warning(`Unable to get closest POI: ${ex.message}`);
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
        return this.httpClient.post(Urls.poiSimple, { latLng: latlng, pointType }).toPromise();
    }
}
