import { Injectable } from "@angular/core";
import { debounceTime } from "rxjs/operators";
import PouchDB from "pouchdb";
import WorkerPouch from "worker-pouch";
import deepmerge from "deepmerge";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { initialState } from "../reducres/initial-state";
import { NgRedux } from "@angular-redux/store";
import { ApplicationState } from "../models/models";
import { classToActionMiddleware } from "../reducres/reducer-action-decorator";
import { rootReducer } from "../reducres/root.reducer";

interface PouchDB {
    adapter: Function;
}

@Injectable()
export class DatabaseService {
    private database;

    constructor(private readonly loggingService: LoggingService,
        private readonly runningContext: RunningContextService,
        private readonly ngRedux: NgRedux<ApplicationState>) {

    }

    public async initialize() {
        let useWorkerPouch = (await WorkerPouch.isSupportedBrowser()) &&
            !this.runningContext.isIos &&
            !this.runningContext.isEdge;
        await this.loggingService.debug(`useWorkerPouch: ${useWorkerPouch}`);
        if (useWorkerPouch) {
            (PouchDB as any).adapter("worker", WorkerPouch);
            this.database = new PouchDB("IHM", { adapter: "worker", auto_compaction: true });
        } else {
            this.database = new PouchDB("IHM", { auto_compaction: true });
        }
        let storedState = initialState;
        if (this.runningContext.isIFrame) {
            this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
        } else {
            try {
                let dbState = await this.database.get("state") as any;
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
                this.database.put({
                    _id: "state",
                    state: initialState
                });
            }
            await this.loggingService.debug(JSON.stringify(storedState));
            this.ngRedux.configureStore(rootReducer, storedState, [classToActionMiddleware]);
            this.ngRedux.select().pipe(debounceTime(useWorkerPouch ? 2000 : 30000)).subscribe(async (state: ApplicationState) => {
                this.updateState(state);
            });
        }
    }

    public async close() {
        let finalState = this.ngRedux.getState();
        await this.updateState(finalState);
    }

    private async updateState(state: ApplicationState) {
        let dbState = await this.database.get("state") as any;
        dbState.state = state;
        this.database.put(dbState);
    }
}