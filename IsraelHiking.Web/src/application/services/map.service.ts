import { inject, Service } from "@angular/core";
import { Store } from "@ngxs/store";
import { MAPLIBRE_WORKER_URL } from "@maplibre/ngx-maplibre-gl/config";
import type { ErrorEvent, GeoJSONFeature, LayerSpecification, Map, Point, PaddingOptions, SourceSpecification, MapMovementEvent } from "maplibre-gl";

import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { LoggingService } from "./logging.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import { SpatialService } from "./spatial.service";
import { ResourcesService } from "./resources.service";
import { DatabaseService, NO_OFFLINE_FILE_MESSAGE } from "./database.service";
import { OverpassTurboService } from "./overpass-turbo.service";
import { SetLocationAction } from "../reducers/location.reducer";
import type { ApplicationState, Bounds, LatLngAltTime } from "../models";

@Service()
export class MapService {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;
    private resolve: (value?: void | PromiseLike<void>) => void;
    private readonly missingImagesArray: string[] = [];
    private currentMap: Map;

    private readonly cancelableTimeoutService = inject(CancelableTimeoutService);
    private readonly loggingService = inject(LoggingService);
    private readonly resourcesService = inject(ResourcesService)
    private readonly databaseService = inject(DatabaseService);
    private readonly overpassTurboService = inject(OverpassTurboService);
    private readonly store = inject(Store);
    private readonly maplibreWorkerUrl = inject(MAPLIBRE_WORKER_URL, { optional: true });

    public initializationPromise = new Promise<void>((resolve) => { this.resolve = resolve; });

    private initializeOncePromise: Promise<void> | null = null;

    /**
     * Loads maplibre, its workers and the protocols used by the map styles.
     * This is deliberately not part of the application initialization since screens that do not show
     * a map (landing, faq, etc.) should not pay for it - maplibre alone is around 200kb.
     * Routes that do show a map wait for this using the map resolver in the routes definition.
     */
    public initialize(): Promise<void> {
        this.initializeOncePromise ??= this.initializeOnce();
        return this.initializeOncePromise;
    }

    private async initializeOnce() {
        if (typeof window === "undefined") {
            return;
        }
        const maplibregl = await import("maplibre-gl");
        // This is needs to be specific since capacitor is not http protocol
        maplibregl.setWorkerUrl(this.getFullUrl(this.maplibreWorkerUrl ?? "maplibre-gl-worker.mjs"));
        maplibregl.setRTLTextPlugin("./mapbox-gl-rtl-text.js", false);
        maplibregl.addProtocol("custom", (params) => this.databaseService.getCustomTile(params.url));
        maplibregl.addProtocol("slice", (params) => this.databaseService.getSliceTile(params.url));
        maplibregl.addProtocol("overpass", (params) => this.overpassTurboService.getOverpassResults(params.url));
        this.store.select((state: ApplicationState) => state.inMemoryState.pannedTimestamp).subscribe(pannedTimestamp => {
            this.cancelableTimeoutService.clearTimeoutByName("panned");
            if (pannedTimestamp) {
                this.cancelableTimeoutService.setTimeoutByName(() => {
                    this.store.dispatch(new SetPannedAction(null));
                }, MapService.NOT_FOLLOWING_TIMEOUT, "panned");
            }
        });
        // "contour-worker" is a custom message added by maplibre-contour and is not a part of maplibre's
        // closed message types enum, so the dispatcher needs to be seen as accepting a free form message.
        const globalDispatcher = maplibregl.getGlobalDispatcher() as unknown as {
            registerMessageHandler: (type: string, handler: () => Promise<void>) => void;
            broadcast: (type: string, data: unknown) => Promise<unknown[]>;
        };
        const promise = new Promise<void>(resolve => {
            globalDispatcher.registerMessageHandler("contour-worker", async () => {
                await globalDispatcher.broadcast("contour-worker", {
                    demUrlPattern: "slice://mapeak.com/vector/data/raster-dem/{z}/{x}/{y}.webp",
                    encoding: "terrarium",
                    maxzoom: 11
                });
                resolve();
            });
        });
        const addProtocolWorkerUrl = this.getFullUrl("add-protocol-worker.js");
        maplibregl.importScriptInWorkers(addProtocolWorkerUrl);
        await Promise.all([
            promise,
            document.fonts.load("12px Noto Sans Cond Bold"),
            document.fonts.load("12px Noto Sans Bold"),
            document.fonts.load("12px Noto Sans Regular")
        ]);
        await document.fonts.ready;
    }

    public setMap(map: Map) {
        this.loggingService.info("[Map] Initializing map");
        this.currentMap = map;
        this.currentMap._zoomLevelsToOverscale = 4;
        this.resolve();

        this.currentMap.on("dragstart", this.onDragstart);
        this.currentMap.setMissingStyleImageResolver(this.resolveMissingStyleImage);
        this.currentMap.on("error", this.onError);
        this.currentMap.on("moveend", this.onMoveEnd);
    }

    public unsetMap() {
        this.loggingService.info("[Map] Uninitializing map");
        if (this.currentMap == null) {
            return;
        }
        this.currentMap.off("dragstart", this.onDragstart);
        this.currentMap.setMissingStyleImageResolver(null);
        this.currentMap.off("error", this.onError);
        this.currentMap.off("moveend", this.onMoveEnd);
        this.initializationPromise = new Promise<void>((resolve) => {
            this.resolve = resolve;
        });
        this.currentMap = null;
    }

    public async addArrowToMap(map: Map) {
        const fullUrl = this.getFullUrl("content/arrow.png");
        const image = await map.loadImage(fullUrl);
        map.addImage("arrow", image.data, { sdf: true });
    }

    public getFullUrl(relativePath: string): string {
        if (typeof document === "undefined") {
            return relativePath;
        }
        const linkEl = document.createElement("a");
        linkEl.href = relativePath;
        return linkEl.href;
    }

    private readonly onDragstart = () => {
        this.store.dispatch(new SetPannedAction(new Date()));
    }

    private readonly resolveMissingStyleImage = async (id: string) => {
        if (!/^http/.test(id)) {
            return;
        }
        if (this.missingImagesArray.includes(id)) {
            return;
        }
        this.missingImagesArray.push(id);
        const image = await this.currentMap.loadImage(id);
        this.currentMap.addImage(id, image.data);
    }

    private readonly onError = (e: ErrorEvent) => {
        if (e?.error?.message?.includes("418")) {
            return;
        }
        if (e?.error?.message?.includes(NO_OFFLINE_FILE_MESSAGE)) {
            this.loggingService.warning("[Map] " + e.error.message);
            return;
        }
        this.loggingService.error("[Map] Error: " + e?.error?.message);
    }

    public readonly onMoveEnd = (e: DragEvent | MapMovementEvent) => {
        if (!e || !this.currentMap) {
            return;
        }
        const centerLatLon = this.currentMap.getCenter();
        const zoom = this.currentMap.getZoom();
        const currentLocation = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
        if (currentLocation.longitude === centerLatLon.lng && currentLocation.latitude === centerLatLon.lat && currentLocation.zoom === zoom) {
            return;
        }
        this.store.dispatch(new SetLocationAction(centerLatLon.lng, centerLatLon.lat, zoom));
    }

    public getMapBounds(): Bounds {
        const bounds = this.currentMap.getBounds();
        return SpatialService.mBBoundsToBounds(bounds);
    }

    public project(latlng: LatLngAltTime): Point {
        return this.currentMap.project(latlng);
    }

    public getFeaturesFromTiles(): GeoJSONFeature[] {
        if (this.currentMap == null) {
            // Map is not ready yet
            return [];
        }
        if (!this.currentMap.getLayer(this.resourcesService.globalPointsExternalLayer)) {
            return [];
        }
        return this.currentMap.queryRenderedFeatures({ layers: [this.resourcesService.globalPointsExternalLayer, this.resourcesService.globalPointsLayer] });
    }

    public isMoving(): boolean {
        return this.currentMap?.isMoving() ?? false;
    }

    public async fitBounds(bounds: Bounds, padding = 50, smallScreenPadding?: PaddingOptions) {
        await this.initializationPromise;
        const maxZoom = Math.max(this.currentMap.getZoom(), 16);
        const mbBounds = SpatialService.boundsToMBBounds(bounds);

        this.store.dispatch(new SetPannedAction(new Date()));
        this.currentMap.fitBounds(mbBounds, {
            maxZoom,
            padding: this.getPadding(padding, smallScreenPadding)
        });
    }

    private getPadding(padding: number, smallScreenPadding?: PaddingOptions) {
        if (!smallScreenPadding) {
            return padding;
        }
        if (window.innerWidth >= 550) {
            return padding;
        }
        return smallScreenPadding;
    }

    public async flyTo(latLng: LatLngAltTime, zoom?: number) {
        await this.initializationPromise;
        if (!zoom) {
            zoom = this.currentMap.getZoom();
        }
        if (SpatialService.getDistance(this.currentMap.getCenter(), latLng) < 0.0001 &&
            Math.abs(zoom - this.currentMap.getZoom()) < 0.01) {
            // ignoring flyto for small coordinates change:
            // this happens due to route percision reduce which causes another map move.
            return;
        }
        this.store.dispatch(new SetPannedAction(new Date()));
        this.currentMap.flyTo({ center: latLng, zoom });
    }

    public async moveToWithCurrentZoom(center: LatLngAltTime, bearing: number) {
        if (!this.currentMap) {
            return;
        }
        this.moveTo(center, this.currentMap.getZoom(), bearing);
    }

    public async moveTo(center: LatLngAltTime, zoom: number, bearing: number) {
        await this.initializationPromise;
        this.currentMap.easeTo({
            bearing,
            center,
            zoom,
            animate: true,
            easing: (x) => x,
            offset: [0, 100]
        });
    }

    public addSource(sourceId: string, source: SourceSpecification) {
        this.currentMap.addSource(sourceId, source);
    }

    public addLayer(layer: LayerSpecification) {
        this.currentMap.addLayer(layer);
    }
}
