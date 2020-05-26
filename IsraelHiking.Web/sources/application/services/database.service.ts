import { Injectable } from "@angular/core";
import { debounceTime } from "rxjs/operators";
import { decode } from "base64-arraybuffer";
import { NgRedux } from "@angular-redux/store";
import { SQLite, SQLiteDatabaseConfig, SQLiteObject } from "@ionic-native/sqlite/ngx";
import Dexie from "dexie";
import deepmerge from "deepmerge";
import * as mapboxgl from "mapbox-gl";
import * as pako from "pako";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { initialState, ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP, SATELLITE, ESRI, HIKING_TRAILS, BICYCLE_TRAILS } from "../reducres/initial-state";
import { classToActionMiddleware } from "../reducres/reducer-action-decorator";
import { rootReducer } from "../reducres/root.reducer";
import { ApplicationState, LatLngAlt } from "../models/models";
import { ToastService } from "./toast.service";
import { ResourcesService } from "./resources.service";

export interface ImageUrlAndData {
    imageUrl: string;
    data: string;
}

@Injectable()
export class DatabaseService {
    private static readonly STATE_DB_NAME = "State";
    private static readonly STATE_TABLE_NAME = "state";
    private static readonly STATE_DOC_ID = "state";
    private static readonly POIS_DB_NAME = "PointsOfInterest";
    private static readonly POIS_TABLE_NAME = "pois";
    private static readonly POIS_ID_COLUMN = "properties.poiId";
    private static readonly POIS_LOCATION_COLUMN = "[properties.poiGeolocation.lat+properties.poiGeolocation.lon]";
    private static readonly IMAGES_DB_NAME = "Images";
    private static readonly IMAGES_TABLE_NAME = "images";

    private stateDatabase: Dexie;
    // HM TODO: only for cordova?
    private poisDatabase: Dexie;
    private imagesDatabase: Dexie;
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
            pois: DatabaseService.POIS_ID_COLUMN + "," + DatabaseService.POIS_LOCATION_COLUMN
        });
        this.imagesDatabase = new Dexie(DatabaseService.IMAGES_DB_NAME);
        this.imagesDatabase.version(1).stores({
            images: "imageUrl"
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
            this.stateDatabase.table(DatabaseService.STATE_TABLE_NAME).put({
                id: DatabaseService.STATE_DOC_ID,
                state: initialState
            });
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
        this.ngRedux.select().pipe(debounceTime(2000)).subscribe(async (state: ApplicationState) => {
            this.updateState(state);
        });
    }

    private initCustomTileLoadFunction() {
        (mapboxgl as any).loadTilesFunction = (params, callback) => {
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
        };
    }

    public async close() {
        let finalState = this.ngRedux.getState();
        // reduce database size and memory footprint
        finalState.routes.past = [];
        finalState.routes.future = [];
        await this.updateState(finalState);
        for (let dbKey of this.sourceDatabases.keys()) {
            await this.closeDatabase(dbKey);
        }
    }

    public async closeDatabase(dbKey: string) {
        this.loggingService.info("Closing database: " + dbKey);
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
        await this.stateDatabase.table(DatabaseService.STATE_TABLE_NAME).put({
            id: DatabaseService.STATE_DOC_ID,
            state
        });
        this.updating = false;
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
                tx.executeSql("SELECT BASE64(tile_data) AS base64_tile_data FROM tiles " +
                    "WHERE zoom_level = ? AND tile_column = ? AND tile_row = ? limit 1",
                    params,
                    (_, res) => {
                        if (res.rows.length !== 1) {
                            reject(new Error("No tile..."));
                            return;
                        }
                        const base64Data = res.rows.item(0).base64_tile_data;
                        let binData = new Uint8Array(decode(base64Data));
                        let isGzipped = binData[0] === 0x1f && binData[1] === 0x8b;
                        if (isGzipped) {
                            binData = pako.inflate(binData);
                        }
                        resolve(binData.buffer);
                    },
                    (error) => {
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
            }
            let db = await this.sqlite.create(config);
            this.sourceDatabases.set(dbName, db);
        }
        return this.sourceDatabases.get(dbName);
    }

    public storePois(pois: GeoJSON.Feature[]): Promise<void> {
        return this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).bulkPut(pois);
    }

    public getPoiById(id: string): Promise<GeoJSON.Feature> {
        return this.poisDatabase.table(DatabaseService.POIS_TABLE_NAME).get(id);
    }

    public storeImages(images: ImageUrlAndData[]): Promise<void> {
        return this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).bulkPut(images);
    }

    public async getImageByUrl(imageUrl: string): Promise<string> {
        let imageAndData = await this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).get(imageUrl) as ImageUrlAndData;
        if (imageAndData != null) {
            return imageAndData.data;
        }
        return null;
    }

    private initialStateUpgrade(dbState: ApplicationState): ApplicationState {
        let storedState = deepmerge(initialState, dbState, {
            arrayMerge: (destinationArray, sourceArray) => {
                return sourceArray == null ? destinationArray : sourceArray;
            }
        });
        storedState.inMemoryState = initialState.inMemoryState;
        if (!this.runningContext.isCordova) {
            storedState.routes = initialState.routes;
        }
        if (storedState.configuration.version === "8.0") {
            this.loggingService.info("Upgrading state from version 8.0 to 9.0");
            storedState.configuration.version = "9.0";
            for (let key of [ISRAEL_HIKING_MAP, ISRAEL_MTB_MAP]) {
                let layer = storedState.layersState.baseLayers.find(l => l.key === key);
                let layerToReplaceWith = initialState.layersState.baseLayers.find(l => l.key === key);
                storedState.layersState.baseLayers.splice(storedState.layersState.baseLayers.indexOf(layer), 1, layerToReplaceWith);
            }
            let esriLayer = storedState.layersState.baseLayers.find(l => l.key === ESRI);
            storedState.layersState.baseLayers.splice(storedState.layersState.baseLayers.indexOf(esriLayer), 1);
            if (storedState.layersState.baseLayers.find(l => l.key === SATELLITE) == null) {
                storedState.layersState.baseLayers.splice(2, 0, initialState.layersState.baseLayers.find(l => l.key === SATELLITE));
            }
            for (let key of [HIKING_TRAILS, BICYCLE_TRAILS]) {
                let layer = storedState.layersState.overlays.find(l => l.key === key);
                let layerToReplaceWith = initialState.layersState.overlays.find(l => l.key === key);
                layerToReplaceWith.visible = layer.visible;
                storedState.layersState.overlays.splice(storedState.layersState.overlays.indexOf(layer), 1, layerToReplaceWith);
            }
        }
        return storedState;
    }
}
