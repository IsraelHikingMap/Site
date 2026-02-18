import { EventEmitter, inject, Injectable } from "@angular/core";
import { type ErrorEvent, GeoJSONFeature, type Map, type Point, setRTLTextPlugin } from "maplibre-gl";
import { Store } from "@ngxs/store";

import { CancelableTimeoutService } from "./cancelable-timeout.service";
import { LoggingService } from "./logging.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import { SpatialService } from "./spatial.service";
import { SidebarService } from "./sidebar.service";
import type { ApplicationState, Bounds, LatLngAltTime } from "../models";

@Injectable()
export class MapService {
    private static readonly NOT_FOLLOWING_TIMEOUT = 20000;
    private resolve: (value?: void | PromiseLike<void>) => void;
    private missingImagesArray: string[] = [];
    private currentMap: Map;

    private readonly sidebarService = inject(SidebarService);
    private readonly cancelableTimeoutService = inject(CancelableTimeoutService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    public initializationPromise = new Promise<void>((resolve) => { this.resolve = resolve; });

    public initialize() {
        setRTLTextPlugin("./mapbox-gl-rtl-text.js", false);
        this.store.select((state: ApplicationState) => state.inMemoryState.pannedTimestamp).subscribe(pannedTimestamp => {
            this.cancelableTimeoutService.clearTimeoutByName("panned");
            if (pannedTimestamp) {
                this.cancelableTimeoutService.setTimeoutByName(() => {
                    this.store.dispatch(new SetPannedAction(null));
                }, MapService.NOT_FOLLOWING_TIMEOUT, "panned");
            }
        });
    }

    public setMap(map: Map) {
        this.currentMap = map;
        this.resolve();

        this.currentMap.on("dragstart", this.onDragstart);
        this.currentMap.on("styleimagemissing", this.onStyleImageMissing);
        this.currentMap.on("error", this.onError);
    }

    public unsetMap() {
        this.currentMap.off("dragstart", this.onDragstart);
        this.currentMap.off("styleimagemissing", this.onStyleImageMissing);
        this.currentMap.off("error", this.onError);
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
        return (window.origin || window.location.origin) + "/" + relativePath;
    }

    private onDragstart = () => {
        this.store.dispatch(new SetPannedAction(new Date()));
    }

    private onStyleImageMissing = async (e: { id: string }) => {
        if (!/^http/.test(e.id)) {
            return;
        }
        if (this.missingImagesArray.includes(e.id)) {
            return;
        }
        this.missingImagesArray.push(e.id);
        const image = await this.currentMap.loadImage(e.id);
        this.currentMap.addImage(e.id, image.data);
    }

    private onError = (e: ErrorEvent) => {
        if (e.error.message.includes("418")) {
            return;
        }
        this.loggingService.error("[Map] Error: " + e?.error?.message);
    }

    public getMapBounds(): Bounds {
        const bounds = this.currentMap.getBounds();
        return SpatialService.mBBoundsToBounds(bounds);
    }

    public project(latlng: LatLngAltTime): Point {
        return this.currentMap.project(latlng);
    }

    public getFeaturesFromTiles(sourceLayers: string[], sourceId: string): GeoJSONFeature[] {
        if (this.currentMap == null) {
            // Map is not ready yet
            return [];
        }
        let features: GeoJSONFeature[] = [];
        for (const sourceLayer of sourceLayers) {
            features = features.concat(this.currentMap.querySourceFeatures(sourceId, { sourceLayer }));
        }
        return features;
    }

    public isMoving(): boolean {
        return this.currentMap?.isMoving() ?? false;
    }

    public async fitBounds(bounds: Bounds, noPadding = false) {
        await this.initializationPromise;
        const maxZoom = Math.max(this.currentMap.getZoom(), 16);
        const mbBounds = SpatialService.boundsToMBBounds(bounds);

        this.store.dispatch(new SetPannedAction(new Date()));
        this.currentMap.fitBounds(mbBounds, {
            maxZoom,
            padding: this.getPadding(noPadding)
        });
    }

    private getPadding(noPadding = false) {
        let padding = 50;
        if (noPadding) {
            padding = 0;
        }
        if (!this.sidebarService.isSidebarOpen()) {
            return padding;
        }
        if (window.innerWidth >= 550) {
            return { top: 50, left: 400, bottom: 50, right: 50 }
        }
        return { top: 50, left: 50, bottom: window.innerHeight / 2, right: 50 }
    }

    public async flyTo(latLng: LatLngAltTime, zoom: number) {
        await this.initializationPromise;
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
}
