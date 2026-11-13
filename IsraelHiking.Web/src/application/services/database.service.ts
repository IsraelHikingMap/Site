import { inject, NgZone, Service } from "@angular/core";
import { HttpClient, HttpErrorResponse } from "@angular/common/http";
import { Store } from "@ngxs/store";
import { firstValueFrom } from "rxjs";
import { debounceTime, timeout } from "rxjs/operators";
import { deepmergeCustom } from "deepmerge-ts";
import Dexie from "dexie";
import type { GetResourceResponse } from "maplibre-gl";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { createNotFoundError, PmTilesService } from "./pmtiles.service";
import { initialState } from "../reducers/initial-state";
import { ClearHistoryAction } from "../reducers/routes.reducer";
import { SetSelectedPoiAction } from "../reducers/poi.reducer";
import { SetLastOfflineDetectedDate } from "../reducers/offline.reducer";
import type { ApplicationState, MutableApplicationState, ShareUrl, Trace } from "../models";

export type ImageUrlAndData = {
    imageUrl: string;
    data: string;
};

/**
 * Prefix of the error thrown when a tile can't be fetched and there's no offline file to fall back to.
 * This is expected when the device is offline and the relevant area was not downloaded, so it is logged as a warning.
 */
export const NO_OFFLINE_FILE_MESSAGE = "There's no offline file";

@Service()
export class DatabaseService {
    /**
     * Arrays from the stored state replace the initial ones instead of being concatenated.
     * The signature is spelled out because deepmerge-ts infers array merging at the type level
     * regardless of the runtime `mergeArrays` option.
     */
    private static readonly mergeState = deepmergeCustom({ mergeArrays: false }) as
        (initial: MutableApplicationState, stored: MutableApplicationState) => MutableApplicationState;

    private static readonly STATE_DB_NAME = "State";
    private static readonly STATE_TABLE_NAME = "state";
    private static readonly STATE_DOC_ID = "state";
    private static readonly POIS_UPLOAD_QUEUE_DB_NAME = "UploadQueue";
    private static readonly POIS_UPLOAD_QUEUE_TABLE_NAME = "uploadQueue";
    private static readonly POIS_ID_COLUMN = "properties.poiId";
    private static readonly IMAGES_DB_NAME = "Images";
    private static readonly IMAGES_TABLE_NAME = "images";
    private static readonly SHARE_URLS_DB_NAME = "ShareUrls";
    private static readonly SHARE_URLS_TABLE_NAME = "shareUrls";
    private static readonly TRACES_DB_NAME = "Traces";
    private static readonly TRACES_TABLE_NAME = "traces";
    /**
     * How long after the server could not be reached a tile that has an offline file is read from it without asking
     * the server first. Without it every zoom the map falls back through for a tile the file does not have would wait
     * for the server again on a slow connection.
     */
    private static readonly SKIP_SERVER_AFTER_FAILURE_MS = 30000;

    private stateDatabase: Dexie;
    private uploadQueueDatabase: Dexie;
    private imagesDatabase: Dexie;
    private shareUrlsDatabase: Dexie;
    private tracesDatabase: Dexie;
    private updating = false;
    private stateSubscriptionTimeout: ReturnType<typeof setTimeout>;
    private lastServerFailureTime = 0;

    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly pmTilesService = inject(PmTilesService);
    private readonly httpClient = inject(HttpClient);
    private readonly store = inject(Store);
    private readonly ngZone = inject(NgZone);

    public async initialize() {
        if (typeof window === "undefined") {
            return;
        }
        this.stateDatabase = new Dexie(DatabaseService.STATE_DB_NAME);
        this.stateDatabase.version(1).stores({
            state: "id"
        });
        this.uploadQueueDatabase = new Dexie(DatabaseService.POIS_UPLOAD_QUEUE_DB_NAME);
        this.uploadQueueDatabase.version(1).stores({
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
            traces: "id"
        });
        if (this.runningContextService.isIFrame) {
            initialState.layersState.visiblePoisCategories = [];
            this.store.reset(initialState);
            return;
        }
        let storedState = initialState;
        const dbState = await this.stateDatabase.table(DatabaseService.STATE_TABLE_NAME).get(DatabaseService.STATE_DOC_ID);
        if (dbState != null) {
            storedState = this.initialStateUpgrade(dbState.state);
        } else {
            // initial load ever:
            if (this.runningContextService.isMobile) {
                initialState.locationState.zoom = 10;
                initialState.gpsState.tracking = "tracking";
            }
            await this.updateState(initialState);
        }

        this.store.reset(storedState);
        this.ngZone.runOutsideAngular(() => {
            this.stateSubscriptionTimeout = setTimeout(() => {
                // Do this only inside the setTimeout to avoid causing angular hydration to delay
                this.store.select(s => s).pipe(debounceTime(2000)).subscribe((state: ApplicationState) => {
                    this.updateState(state);
                });
            }, 3000)
        })
    }

    /**
     * Handles the "custom" protocol, registered by the map service.
     */
    public async getCustomTile(url: string): Promise<GetResourceResponse<ArrayBuffer>> {
        const data = await this.pmTilesService.getTileByUrl(url);
        return { data };
    }

    /**
     * Handles the "slice" protocol, registered by the map service.
     * Falls back to the offline files when the server can not be reached, and reads them without asking the server
     * for a while after that, see SKIP_SERVER_AFTER_FAILURE_MS. A tile the server answers it does not have is a 404
     * and not a sign of being offline, since the DEM has its higher zooms only where there is data.
     */
    public async getSliceTile(url: string): Promise<GetResourceResponse<ArrayBuffer>> {
        // slice://mapeak.com/vector/data/mapeak-schema/{z}/{x}/{y}.mvt
        const splitUrl = url.split("/");
        const type = splitUrl[splitUrl.length - 4];
        const z = +splitUrl[splitUrl.length - 3];
        const x = +splitUrl[splitUrl.length - 2];
        const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);
        const offlineAvailable = await this.pmTilesService.isOfflineFileAvailable(z, x, y, type);
        const sinceServerFailureMs = Date.now() - this.lastServerFailureTime;
        if (offlineAvailable && sinceServerFailureMs < DatabaseService.SKIP_SERVER_AFTER_FAILURE_MS) {
            this.loggingService.info(`[Slice] Reading ${z}/${x}/${y} of ${type} from the offline file without asking the server, ` +
                `which could not be reached ${Math.round(sinceServerFailureMs / 1000)}s ago`);
            return await this.getOfflineTile(z, x, y, type);
        }
        try {
            const response = await firstValueFrom(this.httpClient.get(url.replace("slice://", "https://"), { observe: "response", responseType: "arraybuffer" })
                .pipe(offlineAvailable ? timeout(2000) : timeout(60000)));
            if (!response.ok) {
                throw new Error(`Failed to get ${url}: ${response.status}`);
            }
            const data = response.body ?? new ArrayBuffer(0);
            return { data, cacheControl: response.headers.get("Cache-Control"), expires: response.headers.get("Expires") };
        } catch (ex) {
            if (ex instanceof HttpErrorResponse && ex.status === 404) {
                throw createNotFoundError(`Tile ${z}/${x}/${y} of ${type} is not on the server`);
            }
            // Timeout or other error
            this.lastServerFailureTime = Date.now();
            if (offlineAvailable === false) {
                if (!this.store.selectSnapshot((s: ApplicationState) => s.offlineState.isSubscribed)) {
                    this.store.dispatch(new SetLastOfflineDetectedDate(new Date()));
                }
                throw new Error(`${NO_OFFLINE_FILE_MESSAGE} for tile ${z}/${x}/${y} of ${type}, ` +
                    `and the server could not be reached: ${(ex as Error).message}`, { cause: ex });
            }
            this.loggingService.info(`[Slice] The server could not be reached for ${z}/${x}/${y} of ${type}, reading the offline files ` +
                `without asking it for the next ${DatabaseService.SKIP_SERVER_AFTER_FAILURE_MS / 1000}s: ${(ex as Error).message}`);
            return await this.getOfflineTile(z, x, y, type);
        }
    }

    /** Reads a tile from the offline file, logging a tile it does not have, which the map replaces with the zoom below */
    private async getOfflineTile(z: number, x: number, y: number, type: string): Promise<GetResourceResponse<ArrayBuffer>> {
        try {
            return { data: await this.pmTilesService.getTileByType(z, x, y, type) };
        } catch (ex) {
            this.loggingService.info(`[Slice] ${z}/${x}/${y} of ${type} is not in the offline file: ${(ex as Error).message}`);
            throw ex;
        }
    }

    public async uninitialize() {
        clearTimeout(this.stateSubscriptionTimeout);
        // reduce database size and memory footprint
        this.store.dispatch(new ClearHistoryAction());
        this.store.dispatch(new SetSelectedPoiAction(null));
        const finalState = this.store.selectSnapshot((s: ApplicationState) => s);
        await this.updateState(finalState);
    }

    public async deleteAllData(): Promise<void> {
        this.loggingService.info("[Database] Deleting all the databases");
        this.store.reset(initialState);
        const databases = [
            this.stateDatabase, this.uploadQueueDatabase, this.imagesDatabase,
            this.shareUrlsDatabase, this.tracesDatabase
        ];
        for (const database of databases) {
            database?.close({ disableAutoOpen: false });
        }
        const databaseNames = [
            DatabaseService.STATE_DB_NAME, DatabaseService.POIS_UPLOAD_QUEUE_DB_NAME,
            DatabaseService.IMAGES_DB_NAME, DatabaseService.SHARE_URLS_DB_NAME, DatabaseService.TRACES_DB_NAME
        ];
        await Promise.all(databaseNames.map(databaseName => Dexie.delete(databaseName)));
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

    public async addPoiToUploadQueue(feature: GeoJSON.Feature): Promise<void> {
        await this.uploadQueueDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).put(feature);
    }

    public getPoiFromUploadQueue(featureId: string): Promise<GeoJSON.Feature> {
        return this.uploadQueueDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).get(featureId);
    }

    public removePoiFromUploadQueue(featureId: string): Promise<void> {
        return this.uploadQueueDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).delete(featureId);
    }

    public async storeImages(images: ImageUrlAndData[]): Promise<void> {
        await this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).bulkPut(images);
    }

    public async getImageByUrl(imageUrl: string): Promise<string> {
        const imageAndData = await this.imagesDatabase.table(DatabaseService.IMAGES_TABLE_NAME).get(imageUrl) as ImageUrlAndData;
        if (imageAndData != null) {
            return imageAndData.data;
        }
        return null;
    }

    public async storeShareUrl(shareUrl: ShareUrl): Promise<void> {
        await this.shareUrlsDatabase.table(DatabaseService.SHARE_URLS_TABLE_NAME).put(shareUrl);
    }

    public getShareUrlById(id: string): Promise<ShareUrl> {
        return this.shareUrlsDatabase.table(DatabaseService.SHARE_URLS_TABLE_NAME).get(id);
    }

    public deleteShareUrlById(id: string): Promise<void> {
        return this.shareUrlsDatabase.table(DatabaseService.SHARE_URLS_TABLE_NAME).delete(id);
    }

    public async storeTrace(trace: Trace): Promise<void> {
        await this.tracesDatabase.table(DatabaseService.TRACES_TABLE_NAME).put(trace);
    }

    public getTraceById(id: string): Promise<Trace> {
        return this.tracesDatabase.table(DatabaseService.TRACES_TABLE_NAME).get(id);
    }

    public deleteTraceById(id: string): Promise<void> {
        return this.tracesDatabase.table(DatabaseService.TRACES_TABLE_NAME).delete(id);
    }

    private initialStateUpgrade(dbState: MutableApplicationState): MutableApplicationState {
        const storedState = DatabaseService.mergeState(initialState, dbState);
        if (+dbState.configuration.version < initialState.configuration.version) {
            storedState.configuration.version = initialState.configuration.version;
            storedState.layersState.baseLayers = initialState.layersState.baseLayers;
            storedState.layersState.overlays = initialState.layersState.overlays;
        }
        storedState.inMemoryState = initialState.inMemoryState;
        if (!this.runningContextService.isCapacitor) {
            storedState.routes = initialState.routes;
            storedState.poiState = initialState.poiState;
            storedState.gpsState = initialState.gpsState;
        }
        return storedState;
    }
}
