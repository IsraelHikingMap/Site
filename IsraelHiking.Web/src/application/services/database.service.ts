import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";
import { debounceTime } from "rxjs/operators";
import { SQLite, SQLiteDatabaseConfig, SQLiteObject } from "@ionic-native/sqlite/ngx";
import Dexie from "dexie";
import deepmerge from "deepmerge";
import maplibregl from "maplibre-gl";
import * as pako from "pako";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";
import { initialState } from "../reducers/initial-state";
import { rootReducer } from "../reducers/root.reducer";
import type { ApplicationState, ShareUrl, Trace } from "../models/models";

export type ImageUrlAndData = {
    imageUrl: string;
    data: string;
};

const classToActionMiddleware = (state: any) => (next: any) => (action: any) => next({ ...action });

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
    // HM TODO: only for cordova?
    private poisDatabase: Dexie;
    private imagesDatabase: Dexie;
    private shareUrlsDatabase: Dexie;
    private tracesDatabase: Dexie;
    private sourceDatabases: Map<string, SQLiteObject>;
    private updating: boolean;

    constructor(private readonly loggingService: LoggingService,
                private readonly runningContext: RunningContextService,
                private readonly sqlite: SQLite,
                private readonly toastService: ToastService,
                private readonly resources: ResourcesService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.updating = false;
        this.sourceDatabases = new Map<string, SQLiteObject>();
    }

    public async initialize() {
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
        this.initCustomTileLoadFunction();
        if (this.runningContext.isIFrame) {
            this.ngRedux.configureStore(rootReducer, initialState, [classToActionMiddleware]);
            return;
        }
        let storedState = initialState;
        let dbState = await this.stateDatabase.table(DatabaseService.STATE_TABLE_NAME).get(DatabaseService.STATE_DOC_ID);
        if (dbState != null) {
            storedState = this.initialStateUpgrade(dbState.state);
        } else {
            // initial load ever:
            if (this.runningContext.isCapacitor) {
                initialState.gpsState.tracking = "tracking";
            }
            this.updateState(initialState);
        }
        if (storedState.offlineState.lastModifiedDate !== null) {
            if (await Dexie.exists("IHM")) {
                await Dexie.delete("IHM");
                await Dexie.delete("Contour");
                await Dexie.delete("TerrainRGB");
                storedState.offlineState.lastModifiedDate = null;
                this.toastService.confirm({ type: "Ok", message: this.resources.databaseUpgrade });
            }
        }

        this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
        this.ngRedux.select().pipe(debounceTime(2000)).subscribe((state: any) => {
            this.updateState(state);
        });
    }

    private initCustomTileLoadFunction() {
        maplibregl.addProtocol("custom", (params, callback) => {
            this.getTile(params.url).then((tileBuffer) => {
                if (tileBuffer) {
                    callback(null, tileBuffer, null, null);
                } else {
                    let message = `Tile is not in DB: ${params.url}`;
                    this.loggingService.debug(message);
                    callback(new Error(message));
                }
            });
            return { cancel: () => { } };
        });
    }

    public async uninitialize() {
        let finalState = this.ngRedux.getState();
        // reduce database size and memory footprint
        finalState.routes.past = [];
        finalState.routes.future = [];
        finalState.poiState.selectedPointOfInterest = null;
        finalState.poiState.isSidebarOpen = false;
        await this.updateState(finalState);
        for (let dbKey of this.sourceDatabases.keys()) {
            await this.closeDatabase(dbKey);
        }
    }

    public async closeDatabase(dbKey: string) {
        this.loggingService.info("[Database] Closing database: " + dbKey);
        let db = this.sourceDatabases.get(dbKey);
        if (db != null) {
            await db.close();
            this.sourceDatabases.delete(dbKey);
        } else if (this.sourceDatabases.keys.length > 0) {
            this.loggingService.warning("Unable to close database: " + dbKey);
        }
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

    private getSourceNameFromUrl(url: string) {
        return url.replace("custom://", "").split("/")[0];
    }

    public async getTile(url: string): Promise<ArrayBuffer> {
        let splitUrl = url.split("/");
        let dbName = this.getSourceNameFromUrl(url);
        let z = +splitUrl[splitUrl.length - 3];
        let x = +splitUrl[splitUrl.length - 2];
        let y = +(splitUrl[splitUrl.length - 1].split(".")[0]);

        return this.getTileFromDatabase(dbName, z, x, y);
    }

    private async getTileFromDatabase(dbName: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
        let db = await this.getDatabase(dbName);
        let params = [
            z,
            x,
            Math.pow(2, z) - y - 1
        ];
        return new Promise<ArrayBuffer>((resolve, reject) => {
            db.transaction((tx) => {
                tx.executeSql("SELECT HEX(tile_data) as tile_data_hex FROM tiles " +
                    "WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? limit 1",
                    params,
                    (_: any, res: any) => {
                        if (res.rows.length !== 1) {
                            reject(new Error("No tile..."));
                            return;
                        }
                        const hexData = res.rows.item(0).tile_data_hex;
                        let binData = new Uint8Array(hexData.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
                        let isGzipped = binData[0] === 0x1f && binData[1] === 0x8b;
                        if (isGzipped) {
                            binData = pako.inflate(binData);
                        }
                        resolve(binData.buffer);
                    },
                    (error: Error) => {
                        reject(error);
                    }
                );
            });
        });
    }

    private async getDatabase(dbName: string): Promise<SQLiteObject> {
        if (!this.sourceDatabases.has(dbName)) {
            let config: SQLiteDatabaseConfig = {
                createFromLocation: 1,
                name: dbName + ".mbtiles"
            };
            if (this.runningContext.isIos) {
                config.iosDatabaseLocation = "Documents";
            } else {
                config.location = "default";
                (config as any).androidDatabaseProvider = "system";
            }
            let db = await this.sqlite.create(config);
            this.sourceDatabases.set(dbName, db);
        }
        return this.sourceDatabases.get(dbName);
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
        let size = 2000;
        let currentFeatures = [];
        do {
            currentFeatures = await this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).offset(index * size).limit(size).toArray();
            features = features.concat(currentFeatures);
            index++;
        } while (currentFeatures.length !== 0);
        this.loggingService.debug("[Database] Finished getting pois for clustering in chunks: " + features.length);
        let pointFeatures = features.map((feature: GeoJSON.Feature) => {
            let geoLocation = feature.properties.poiGeolocation;
            let pointFeature = {
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
        let imageAndData = await this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).get(imageUrl) as ImageUrlAndData;
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

    private initialStateUpgrade(dbState: ApplicationState): ApplicationState {
        let storedState = deepmerge(initialState, dbState, {
            arrayMerge: (destinationArray, sourceArray) => sourceArray == null ? destinationArray : sourceArray
        });
        storedState.inMemoryState = initialState.inMemoryState;
        if (!this.runningContext.isCapacitor) {
            storedState.routes = initialState.routes;
            storedState.poiState = initialState.poiState;
            storedState.gpsState = initialState.gpsState;
        }
        return storedState;
    }
}
