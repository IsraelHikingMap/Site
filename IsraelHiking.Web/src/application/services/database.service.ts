import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpResponse } from "@angular/common/http";
import { Store } from "@ngxs/store";
import { firstValueFrom } from "rxjs";
import { debounceTime, timeout } from "rxjs/operators";
import { addProtocol } from "maplibre-gl";
import Dexie from "dexie";
import deepmerge from "deepmerge";

import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { PmTilesService } from "./pmtiles.service";
import { POPULARITY_HEATMAP, initialState } from "../reducers/initial-state";
import { ClearHistoryAction } from "../reducers/routes.reducer";
import { SetSelectedPoiAction } from "../reducers/poi.reducer";
import type { ApplicationState, MutableApplicationState, ShareUrl, Trace } from "../models/models";

export const TILES_ZOOM = 7;

export type ImageUrlAndData = {
    imageUrl: string;
    data: string;
};

@Injectable()
export class DatabaseService {
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

    private stateDatabase: Dexie;
    private uploadQueueDatabase: Dexie;
    private imagesDatabase: Dexie;
    private shareUrlsDatabase: Dexie;
    private tracesDatabase: Dexie;
    private updating = false;

    private readonly loggingService = inject(LoggingService);
    private readonly runningContext = inject(RunningContextService);
    private readonly pmTilesService = inject(PmTilesService);
    private readonly httpClient = inject(HttpClient);
    private readonly store = inject(Store);

    public async initialize() {
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
            const data = await this.pmTilesService.getTile(params.url);
            return {data};
        });
        addProtocol("slice", async (params, _abortController) => {
            // slice://mapeak.com/vector/data/IHM-schema/{z}/{x}/{y}.mvt
            try {
                this.loggingService.info(`[Database] Fetching ${params.url}`);
                const response = await firstValueFrom(this.httpClient.get(params.url.replace("slice://", "https://"), { observe: "response", responseType: "arraybuffer" })
                    .pipe(timeout(2000))) as any as HttpResponse<any>;
                if (!response.ok) {
                    this.loggingService.info(`[Database] Failed fetching with error: ${response.status}: ${params.url}`);
                    throw new Error(`Failed to get ${params.url}: ${response.statusText}`);
                }
                const data = response.body;
                return {data, cacheControl: response.headers.get("Cache-Control"), expires: response.headers.get("Expires")};
            } catch (ex) {
                this.loggingService.info(`[Database] Failed fetching with error: ${(ex as any).message}: ${params.url}`);
                // Timeout or other error
                if (!this.store.selectSnapshot((state: ApplicationState) => state.offlineState).isSubscribed) {
                    throw ex;
                }
                const splitUrl = params.url.split("/");
                const type = splitUrl[splitUrl.length - 4];
                const z = +splitUrl[splitUrl.length - 3];
                const x = +splitUrl[splitUrl.length - 2];
                const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);
                // find the tile x, y, for zoom 7:
                if (z >= TILES_ZOOM) {
                    const targetZoom = TILES_ZOOM;
                    const scale = Math.pow(2, z - targetZoom);
                    const tileX = Math.floor(x / scale);
                    const tileY = Math.floor(y / scale);
                    const fileName = `${type}+${TILES_ZOOM}-${tileX}-${tileY}.pmtiles`;
                    const data = await this.pmTilesService.getTileFromFile(fileName, z, x, y);
                    this.loggingService.info(`[Database] got tile for ${z}/${x}/${y} from ${fileName}`);
                    return { data };
                } else {
                    const fileName = `${type}-${TILES_ZOOM-1}.pmtiles`;
                    const data = await this.pmTilesService.getTileFromFile(fileName, z, x, y);
                    this.loggingService.info(`[Database] got tile for ${z}/${x}/${y} from ${fileName}`);
                    return { data };
                }
            }
        });
    }

    public async uninitialize() {
        // reduce database size and memory footprint
        this.store.dispatch(new ClearHistoryAction());
        this.store.dispatch(new SetSelectedPoiAction(null));
        const finalState = this.store.snapshot() as ApplicationState;
        await this.updateState(finalState);
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

    public addPoiToUploadQueue(feature: GeoJSON.Feature): Promise<any> {
        return this.uploadQueueDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).put(feature);
    }

    public getPoiFromUploadQueue(featureId: string): Promise<GeoJSON.Feature> {
        return this.uploadQueueDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).get(featureId);
    }

    public removePoiFromUploadQueue(featureId: string): Promise<void> {
        return this.uploadQueueDatabase.table(DatabaseService.POIS_UPLOAD_QUEUE_TABLE_NAME).delete(featureId);
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
