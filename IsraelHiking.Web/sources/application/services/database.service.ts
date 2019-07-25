import { Injectable } from "@angular/core";
import { debounceTime } from "rxjs/operators";
import PouchDB from "pouchdb";
import pouchdbLoad from "pouchdb-load";
import WorkerPouch from "worker-pouch";
import deepmerge from "deepmerge";
import * as mapboxgl from "mapbox-gl";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { initialState } from "../reducres/initial-state";
import { NgRedux } from "@angular-redux/store";
import { ApplicationState } from "../models/models";
import { classToActionMiddleware } from "../reducres/reducer-action-decorator";
import { rootReducer } from "../reducres/root.reducer";

interface PouchDB {
    adapter: (name: string, adapter: any) => void;
}

@Injectable()
export class DatabaseService {
    private useWorkers: boolean;
    private stateDatabase: PouchDB.Database;
    private sourcesDatabases: Map<string, PouchDB.Database>;
    private updating: boolean;

    constructor(private readonly loggingService: LoggingService,
                private readonly runningContext: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.updating = false;
        this.useWorkers = false;
        this.sourcesDatabases = new Map();
    }

    public async initialize() {
        this.useWorkers = !this.runningContext.isIos && !this.runningContext.isEdge &&
            (await WorkerPouch.isSupportedBrowser());
        if (this.useWorkers) {
            (PouchDB as any).adapter("worker", WorkerPouch);
            PouchDB.plugin(pouchdbLoad);
        }
        this.stateDatabase = new PouchDB("IHM", this.getAdapeterSettings());
        let storedState = initialState;
        if (this.runningContext.isIFrame) {
            this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
        } else {
            try {
                let dbState = await this.stateDatabase.get("state") as any;
                storedState = deepmerge(initialState, dbState.state, {
                    arrayMerge: (destinationArray, sourceArray) => {
                        return sourceArray == null ? destinationArray : sourceArray;
                    }
                });
                storedState.inMemoryState = initialState.inMemoryState;
                if (!this.runningContext.isCordova) {
                    storedState.routes = initialState.routes;
                }
            } catch (ex) {
                // no initial state.
                this.stateDatabase.put({
                    _id: "state",
                    state: initialState
                });
            }
            this.loggingService.debug(JSON.stringify(storedState));
            this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
            this.ngRedux.select().pipe(debounceTime(this.useWorkers ? 2000 : 30000)).subscribe(async (state: ApplicationState) => {
                this.updateState(state);
            });
            this.initCustomTileLoadFunction();
        }
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
        let dbState = await this.stateDatabase.get("state") as any;
        if (this.updating) {
            return;
        }
        this.updating = true;
        dbState.state = state;
        await this.stateDatabase.put(dbState);
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

    private getAdapeterSettings() {
        if (this.useWorkers) {
            return { adapter: "worker", auto_compaction: true };
        } else {
            return { auto_compaction: true };
        }
    }

    public async getTile(url: string): Promise<ArrayBuffer> {
        let dbName = this.getDbNameFromUrl(url);
        let db = this.getDatabase(dbName);
        try {
            let splitUrl = url.split("/");
            let id = splitUrl[splitUrl.length - 3] + "_" + splitUrl[splitUrl.length - 2] +
                "_" + splitUrl[splitUrl.length - 1].split(".")[0]
            let tileBlob = await db.getAttachment(id, id);
            let response = new Response(tileBlob);
            return response.arrayBuffer();
        } catch (ex) {
            return null;
        }
    }

    public async saveContent(dbName: string, sourceText: string): Promise<void> {
        await (this.getDatabase(dbName) as any).load(sourceText);
    }

    private getDatabase(dbName: string): PouchDB.Database {
        if (!this.sourcesDatabases.has(dbName)) {
            this.sourcesDatabases.set(dbName, new PouchDB(dbName, this.getAdapeterSettings()));
        }
        return this.sourcesDatabases.get(dbName);
    }
}
