import { Injectable } from "@angular/core";
import { Store } from "@ngxs/store";
import { debounceTime } from "rxjs/operators";
import { CapacitorSQLite, SQLiteDBConnection, SQLiteConnection} from "@capacitor-community/sqlite";
import { gunzipSync } from "fflate";
import Dexie from "dexie";
import deepmerge from "deepmerge";
import maplibregl from "maplibre-gl";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { PmTilesService } from "./pmtiles.service";
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
    private sourceDatabases: Map<string, Promise<SQLiteDBConnection>>;
    private updating: boolean;
    private sqlite: SQLiteConnection;

    constructor(private readonly loggingService: LoggingService,
                private readonly runningContext: RunningContextService,
                private readonly pmTilesService: PmTilesService,
                private readonly store: Store) {
        this.updating = false;
        this.sourceDatabases = new Map<string, Promise<SQLiteDBConnection>>();
    }

    public async initialize() {
        this.stateDatabase = new Dexie(DatabaseService.STATE_DB_NAME);
        this.stateDatabase.version(1).stores({
            state: "id"
        });
        if (this.runningContext.isCapacitor) {
            this.sqlite = new SQLiteConnection(CapacitorSQLite);
        }
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
        maplibregl.addProtocol("custom", (params, callback) => {
            this.getTile(params.url).then((tileBuffer) => {
                if (tileBuffer) {
                    callback(null, tileBuffer, null, null);
                } else {
                    const message = `Tile is not in DB: ${params.url}`;
                    callback(new Error(message));
                }
            }).catch((err) => {
                callback(err);
            });
            return { cancel: () => { } };
        });
    }

    public async uninitialize() {
        // reduce database size and memory footprint
        this.store.dispatch(new ClearHistoryAction());
        this.store.dispatch(new SetSelectedPoiAction(null));
        this.store.dispatch(new SetSidebarAction(false));
        const finalState = this.store.snapshot() as ApplicationState;
        await this.updateState(finalState);
        for (const dbKey of this.sourceDatabases.keys()) {
            await this.closeDatabase(dbKey);
        }
    }

    public async closeDatabase(dbKey: string) {
        this.loggingService.info("[Database] Closing " + dbKey);
        if (!this.sourceDatabases.has(dbKey)) {
            this.loggingService.info(`[Database] ${dbKey} was never opened`);
            return;
        }
        try {
            const db = await this.sourceDatabases.get(dbKey);
            await db.close();
            this.loggingService.info("[Database] Closed succefully: " + dbKey);
            await this.sqlite.closeConnection(dbKey + ".db", true);
            this.loggingService.info("[Database] Connection closed succefully: " + dbKey);
            this.sourceDatabases.delete(dbKey);
        } catch (ex) {
            this.loggingService.error(`[Database] Unable to close ${dbKey}, ${(ex as Error).message}`);
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
        try {
            return await this.pmTilesService.getTile(url);
        } catch (ex) {
            this.loggingService.error(`[Database] Failed to get tile from pmtiles: ${(ex as Error).message}`);
        }
        const splitUrl = url.split("/");
        const dbName = this.getSourceNameFromUrl(url);
        const z = +splitUrl[splitUrl.length - 3];
        const x = +splitUrl[splitUrl.length - 2];
        const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);

        return this.getTileFromDatabase(dbName, z, x, y);
    }

    private async getTileFromDatabase(dbName: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
        const db = await this.getDatabase(dbName);

        const params = [z, x, Math.pow(2, z) - y - 1];
        const queryresults = await db.query("SELECT HEX(tile_data) as tile_data_hex FROM tiles " +
                "WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? limit 1",
                params);
        if (queryresults.values.length !== 1) {
            throw new Error("Unable to get tile from database");
        }
        const hexData = queryresults.values[0].tile_data_hex;
        let binData = new Uint8Array(hexData.match(/.{1,2}/g).map((byte: string) => parseInt(byte, 16)));
        const isGzipped = binData[0] === 0x1f && binData[1] === 0x8b;
        if (isGzipped) {
            binData = gunzipSync(binData);
        }
        return binData.buffer;
    }

    private async getDatabase(dbName: string): Promise<SQLiteDBConnection> {
        if (this.sourceDatabases.has(dbName)) {
            try {
                const db = await this.sourceDatabases.get(dbName);
                return db;
            } catch (ex) {
                this.loggingService.error(`[Database] There's a problem with the connection to ${dbName}, ${(ex as Error).message}`);
            }
        }
        this.loggingService.info(`[Database] Creating connection to ${dbName}`);
        this.sourceDatabases.set(dbName, this.createConnection(dbName));
        return this.sourceDatabases.get(dbName);
    }

    private async createConnection(dbName: string) {
        try {
            const dbPromise = this.sqlite.createConnection(dbName + ".db", false, "no-encryption", 1, true);
            const db = await dbPromise;
            this.loggingService.info(`[Database] Connection created succefully to ${dbName}`);
            await db.open();
            this.loggingService.info(`[Database] Connection opened succefully: ${dbName}`);
            return db;
        } catch (ex) {
            this.loggingService.error(`[Database] Failed opening ${dbName}, ${(ex as Error).message}`);
            throw ex;
        }
    }

    public async moveDownloadedDatabaseFile(dbFileName: string) {
        await this.closeDatabase(dbFileName.replace(".db", ""));
        this.loggingService.info(`[Database] Starting moving file ${dbFileName}`);
        await this.sqlite.moveDatabasesAndAddSuffix("cache", [dbFileName]);
        this.loggingService.info(`[Database] Finished moving file ${dbFileName}`);
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

    public async migrateDatabasesIfNeeded(): Promise<void> {
        this.loggingService.info("[Database] Starting migrating old databases using sqlite plugin");
        await this.sqlite.moveDatabasesAndAddSuffix("default", ["Contour.db", "IHM.db", "TerrainRGB.db"]);
        const databases = await this.sqlite.getDatabaseList();
        this.loggingService.info("[Database] Finished migrating old databases using sqlite plugin, " + JSON.stringify(databases.values));
    }
}
