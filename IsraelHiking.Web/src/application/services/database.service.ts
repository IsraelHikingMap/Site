import { Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import { debounceTime } from "rxjs/operators";
import { addProtocol } from "maplibre-gl";
import Dexie from "dexie";
import deepmerge from "deepmerge";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { PmTilesService } from "./pmtiles.service";
import { MBTilesService } from "./mbtiles.service";
import { POPULARITY_HEATMAP, initialState } from "../reducers/initial-state";
import { ClearHistoryAction } from "../reducers/routes.reducer";
import { SetSelectedPoiAction, SetSidebarAction } from "../reducers/poi.reducer";
import type { ApplicationState, MutableApplicationState, ShareUrl, Trace } from "../models/models";

export type ImageUrlAndData = {
    imageUrl: string;
    data: string;
};

@Injectable()
export class DatabaseService {
    private static readonly STATE_DB_NAME = "State";
    private static readonly STATE_TABLE_NAME = "state";
    private static readonly STATE_DOC_ID = "state";
    private static readonly POIS_DB_NAME = "PointsOfInterest";
    private static readonly POIS_TABLE_NAME = "pois";
    private static readonly POIS_UPLOAD_QUEUE_TABLE_NAME = "uploadQueue";
    private static readonly POIS_ID_COLUMN = "properties.poiId";
    private static readonly POIS_LOCATION_COLUMN = "[properties.poiGeolocation.lat+properties.poiGeolocation.lon]";
    private static readonly IMAGES_DB_NAME = "Images";
    private static readonly IMAGES_TABLE_NAME = "images";
    private static readonly SHARE_URLS_DB_NAME = "ShareUrls";
    private static readonly SHARE_URLS_TABLE_NAME = "shareUrls";
    private static readonly TRACES_DB_NAME = "Traces";
    private static readonly TRACES_TABLE_NAME = "traces";

    private stateDatabase: Dexie;
    private poisDatabase: Dexie;
    private imagesDatabase: Dexie;
    private shareUrlsDatabase: Dexie;
    private tracesDatabase: Dexie;
    private updating: boolean;

    constructor(private readonly loggingService: LoggingService,
                private readonly runningContext: RunningContextService,
                private readonly pmTilesService: PmTilesService,
                private readonly mbtilesService: MBTilesService,
                private readonly store: Store) {
        this.updating = false;
    }

    public async initialize() {
        this.mbtilesService.initialize();
        this.stateDatabase = new Dexie(DatabaseService.STATE_DB_NAME);
        this.stateDatabase.version(1).stores({
            state: "id"
        });
        this.poisDatabase = new Dexie(DatabaseService.POIS_DB_NAME);
        this.poisDatabase.version(1).stores({
            pois: DatabaseService.POIS_ID_COLUMN + "," + DatabaseService.POIS_LOCATION_COLUMN,
        });
        this.poisDatabase.version(2).stores({
            uploadQueue: DatabaseService.POIS_ID_COLUMN
        });
        this.imagesDatabase = new Dexie(DatabaseService.IMAGES_DB_NAME);
        this.imagesDatabase.version(1).stores({
            images: "imageUrl"
        });
        this.shareUrlsDatabase = new Dexie(DatabaseService.SHARE_URLS_DB_NAME);
        this.shareUrlsDatabase.version(1).stores({
            shareUrls: "id"
        });
        this.tracesDatabase = new Dexie(DatabaseService.TRACES_DB_NAME);
        this.tracesDatabase.version(1).stores({
            traces: "id",
        });
        if (this.runningContext.isIFrame) {
            this.store.reset(initialState);
            return;
        }
        this.initCustomTileLoadFunction();
        let storedState = initialState;
        const dbState = await this.stateDatabase.table(DatabaseService.STATE_TABLE_NAME).get(DatabaseService.STATE_DOC_ID);
        if (dbState != null) {
            storedState = this.initialStateUpgrade(dbState.state);
        } else {
            // initial load ever:
            if (this.runningContext.isMobile) {
                initialState.gpsState.tracking = "tracking";
            }
            this.updateState(initialState);
        }

        this.store.reset(storedState);
        this.store.select(s => s).pipe(debounceTime(2000)).subscribe((state: ApplicationState) => {
            this.updateState(state);
        });
    }

    private initCustomTileLoadFunction() {
        addProtocol("custom", async (params, _abortController) => {
            const data = await this.getTile(params.url);
            return {data};
        });
    }

    public async uninitialize() {
        // reduce database size and memory footprint
        this.store.dispatch(new ClearHistoryAction());
        this.store.dispatch(new SetSelectedPoiAction(null));
        this.store.dispatch(new SetSidebarAction(false));
        const finalState = this.store.snapshot() as ApplicationState;
        await this.updateState(finalState);
        await this.mbtilesService.uninitialize();
    }

    private async updateState(state: ApplicationState) {
        if (this.updating) {
            return;
        }
        this.updating = true;
        try {
            await this.stateDatabase.table(DatabaseService.STATE_TABLE_NAME).put({
                id: DatabaseService.STATE_DOC_ID,
                state
            });
        } catch (ex) {
            this.loggingService.warning("[Database] Unable to store the state: " + (ex as Error).message);
        } finally {
            this.updating = false;
        }
    }

    public async getTile(url: string): Promise<ArrayBuffer> {
        try {
            return await this.pmTilesService.getTile(url);
        } catch (ex) {
            this.loggingService.error(`[Database] Failed to get tile from pmtiles: ${(ex as Error).message}`);
        }
        return this.mbtilesService.getTile(url);
    }

    public storePois(pois: GeoJSON.Feature[]): Promise<any> {
        return this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).bulkPut(pois);
    }

    public deletePois(poiIds: string[]): Promise<void> {
        return this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).bulkDelete(poiIds);
    }

    public async getPoisForClustering(): Promise<GeoJSON.Feature<GeoJSON.Point>[]> {
        this.loggingService.debug("[Database] Startting getting pois for clustering in chunks");
        let features = [] as GeoJSON.Feature<GeoJSON.Point>[];
        let index = 0;
        const size = 2000;
        let currentFeatures = [];
        do {
            currentFeatures = await this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).offset(index * size).limit(size).toArray();
            features = features.concat(currentFeatures);
            index++;
        } while (currentFeatures.length !== 0);
        this.loggingService.debug("[Database] Finished getting pois for clustering in chunks: " + features.length);
        const pointFeatures = features.map((feature: GeoJSON.Feature) => {
            const geoLocation = feature.properties.poiGeolocation;
            const pointFeature = {
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [parseFloat(geoLocation.lon), parseFloat(geoLocation.lat)]
                },
                properties: feature.properties
            } as GeoJSON.Feature<GeoJSON.Point>;
            return pointFeature;
        });
        return pointFeatures;
    }

    public getPoiById(id: string): Promise<GeoJSON.Feature> {
        return this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).get(id);
    }

    public addPoiToUploadQueue(feature: GeoJSON.Feature): Promise<any> {
        return this.poisDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).put(feature);
    }

    public getPoiFromUploadQueue(featureId: string): Promise<GeoJSON.Feature> {
        return this.poisDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).get(featureId);
    }

    public removePoiFromUploadQueue(featureId: string): Promise<void> {
        return this.poisDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).delete(featureId);
    }

    public storeImages(images: ImageUrlAndData[]): Promise<any> {
        return this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).bulkPut(images);
    }

    public async getImageByUrl(imageUrl: string): Promise<string> {
        const imageAndData = await this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).get(imageUrl) as ImageUrlAndData;
        if (imageAndData != null) {
            return imageAndData.data;
        }
        return null;
    }

    public storeShareUrl(shareUrl: ShareUrl): Promise<any> {
        return this.shareUrlsDatabase.table(DatabaseService.SHARE_URLS_TABLE_NAME).put(shareUrl);
    }

    public getShareUrlById(id: string): Promise<ShareUrl> {
        return this.shareUrlsDatabase.table(DatabaseService.SHARE_URLS_TABLE_NAME).get(id);
    }

    public deleteShareUrlById(id: string): Promise<void> {
        return this.shareUrlsDatabase.table(DatabaseService.SHARE_URLS_TABLE_NAME).delete(id);
    }

    public storeTrace(trace: Trace): Promise<any> {
        return this.tracesDatabase.table(DatabaseService.TRACES_TABLE_NAME).put(trace);
    }

    public getTraceById(id: string): Promise<Trace> {
        return this.tracesDatabase.table(DatabaseService.TRACES_TABLE_NAME).get(id);
    }

    public deleteTraceById(id: string): Promise<void> {
        return this.tracesDatabase.table(DatabaseService.TRACES_TABLE_NAME).delete(id);
    }

    private initialStateUpgrade(dbState: MutableApplicationState): MutableApplicationState {
        const storedState = deepmerge(initialState, dbState, {
            arrayMerge: (destinationArray, sourceArray) => sourceArray == null ? destinationArray : sourceArray
        });
        storedState.inMemoryState = initialState.inMemoryState;
        if (storedState.layersState.overlays.find(o => o.key === POPULARITY_HEATMAP) == null) {
            storedState.layersState.overlays.push(initialState.layersState.overlays.find(o => o.key === POPULARITY_HEATMAP));
        }
        if (!this.runningContext.isCapacitor) {
            storedState.routes = initialState.routes;
            storedState.poiState = initialState.poiState;
            storedState.gpsState = initialState.gpsState;
        }
        return storedState;
    }
}
