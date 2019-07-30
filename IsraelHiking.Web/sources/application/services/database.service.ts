import { Injectable } from "@angular/core";
import { debounceTime } from "rxjs/operators";
import { decode } from "base64-arraybuffer";
import PouchDB from "pouchdb";
import Dexie from "dexie";
import deepmerge from "deepmerge";
import * as mapboxgl from "mapbox-gl";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { initialState } from "../reducres/initial-state";
import { NgRedux } from "@angular-redux/store";
import { ApplicationState } from "../models/models";
import { classToActionMiddleware } from "../reducres/reducer-action-decorator";
import { rootReducer } from "../reducres/root.reducer";

@Injectable()
export class DatabaseService {
    private stateDatabase: Dexie;
    private sourcesDatabases: Map<string, Dexie>;
    private updating: boolean;

    constructor(private readonly loggingService: LoggingService,
        private readonly runningContext: RunningContextService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        this.updating = false;
        this.sourcesDatabases = new Map<string, Dexie>();
    }

    public async initialize() {
        this.stateDatabase = new Dexie('State');
        this.stateDatabase.version(1).stores({
            state: 'id'
        });
        this.initCustomTileLoadFunction();
        let storedState = initialState;
        if (this.runningContext.isIFrame) {
            this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
            return;
        }
        let oldDb = new PouchDB("IHM", { auto_compaction: true });
        let dbState = await this.stateDatabase.table("state").get("state");
        try {
            let state = await oldDb.get("state") as any;
            this.loggingService.debug("State exists in pouch db: " + (state != null).toString());
            await oldDb.remove(state);
            dbState = {
                id: "state",
                state: state.state
            };
        } catch {
            // don't do anything - this is for a transition phase...
            this.loggingService.debug("State does not exists in pouch db");
        }
        if (dbState != null) {
            storedState = deepmerge(initialState, dbState.state, {
                arrayMerge: (destinationArray, sourceArray) => {
                    return sourceArray == null ? destinationArray : sourceArray;
                }
            });
            storedState.inMemoryState = initialState.inMemoryState;
            if (!this.runningContext.isCordova) {
                storedState.routes = initialState.routes;
            }
        } else {
            this.stateDatabase.table("state").put({
                id: "state",
                state: initialState
            });
        }
        this.loggingService.debug(JSON.stringify(storedState));
        this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
        this.ngRedux.select().pipe(debounceTime(2000)).subscribe(async (state: ApplicationState) => {
            this.updateState(state);
        });
    }

    private initCustomTileLoadFunction() {
        (mapboxgl as any).loadTilesFunction = (params, callback) => {
            this.loggingService.debug("Getting tile: " + params.url);
            this.getTile(params.url).then((tileBuffer) => {
                if (tileBuffer) {
                    this.loggingService.debug("Got tile: " + params.url);
                    callback(null, tileBuffer, null, null);
                } else {
                    let message = `Tile is not in DB: ${params.url}`;
                    this.loggingService.debug(message);
                    callback(new Error(message));
                }
            });
            return { cancel: () => { } };
        }
    }

    public async close() {
        let finalState = this.ngRedux.getState();
        await this.updateState(finalState);
    }

    private async updateState(state: ApplicationState) {
        if (this.updating) {
            return;
        }
        this.updating = true;
        await this.stateDatabase.table("state").put({
            id: "state",
            state: state
        });
        this.updating = false;
        this.loggingService.debug("State was updated");
    }

    public getDbNameFromUrl(url: string) {
        let splitUrl = url.replace("custom://", "").split("/");
        splitUrl.pop();
        splitUrl.pop();
        splitUrl.pop();
        return splitUrl.join("_");
    }

    public async getTile(url: string): Promise<ArrayBuffer> {
        let dbName = this.getDbNameFromUrl(url);
        let db = this.getDatabase(dbName);
        let splitUrl = url.split("/");
        let id = splitUrl[splitUrl.length - 3] + "_" + splitUrl[splitUrl.length - 2] +
            "_" + splitUrl[splitUrl.length - 1].split(".")[0]
        let tile = await db.table("tiles").get(id);
        if (tile == null) {
            return null;
        }
        return decode(tile.data);
    }

    public async saveContent(dbName: string, sourceText: string): Promise<void> {
        let objectToSave = JSON.parse(sourceText.trim());
        await this.getDatabase(dbName).table("tiles").bulkPut(objectToSave);
    }

    private getDatabase(dbName: string): Dexie {
        if (!this.sourcesDatabases.has(dbName)) {
            let db = new Dexie(dbName);
            db.version(1).stores({
                tiles: "id, x, y"
            });
            this.sourcesDatabases.set(dbName, db);
        }
        return this.sourcesDatabases.get(dbName);
    }
}
