import { Injectable } from "@angular/core";
import { Router } from "@angular/router";
import { Store } from "@ngxs/store";

import { MapService } from "./map.service";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAlt } from "../models/models";

export type PoiRouterData = {
    source: string;
    id: string;
    language: string;
};

export const getIdFromLatLng = (latLng: LatLngAlt): string => latLng.lat.toFixed(6) + "_" + latLng.lng.toFixed(6);

export class RouteStrings {
    public static readonly MAP = "map";
    public static readonly SHARE = "share";
    public static readonly URL = "url";
    public static readonly POI = "poi";
    public static readonly ROUTE_ROOT = "/";
    public static readonly ROUTE_MAP = `/${RouteStrings.MAP}`;
    public static readonly ROUTE_SHARE = `/${RouteStrings.SHARE}`;
    public static readonly ROUTE_URL = `/${RouteStrings.URL}`;
    public static readonly ROUTE_POI = `/${RouteStrings.POI}`;
    public static readonly COORDINATES = "Coordinates";

    public static readonly LAT = "lat";
    public static readonly LON = "lon";
    public static readonly ZOOM = "zoom";
    public static readonly ID = "id";
    public static readonly SOURCE = "source";
    public static readonly BASE_LAYER = "baselayer";
    public static readonly LANGUAGE = "language";
    public static readonly EDIT = "edit";
}

@Injectable()
export class HashService {

    private static readonly PERSICION = 4;
    private static readonly HIGH_PERSICION = 6;
    private static readonly ZOOM_PERSICION = 2;

    constructor(private readonly router: Router,
                private readonly mapService: MapService,
                private readonly store: Store) {
    }

    public resetAddressbar(): void {
        if (this.store.selectSnapshot((s: ApplicationState) => s.poiState).isSidebarOpen) {
            return;
        }
        const inMemoryState = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState);
        if (inMemoryState.shareUrl) {
            this.router.navigate([RouteStrings.ROUTE_SHARE, inMemoryState.shareUrl.id], { replaceUrl: true });
            return;
        }
        if (inMemoryState.fileUrl) {
            const queryParams = {} as any;
            if (inMemoryState.baseLayer) {
                queryParams.baselayer = inMemoryState.baseLayer;
            }
            this.router.navigate([RouteStrings.ROUTE_URL, inMemoryState.fileUrl],
                { queryParams, replaceUrl: true });
            return;
        }
        if (this.mapService.map && this.mapService.map.isMoving()) {
            return;
        }
        const location = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        this.router.navigate([
            RouteStrings.ROUTE_MAP,
            (location.zoom + 1).toFixed(HashService.ZOOM_PERSICION),
            location.latitude.toFixed(HashService.PERSICION),
            location.longitude.toFixed(HashService.PERSICION)
        ], { replaceUrl: true });
    }

    public getHref(): string {
        const inMemoryState = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState);
        if (inMemoryState.fileUrl != null) {
            const urlTree = this.router.createUrlTree([RouteStrings.URL, inMemoryState.fileUrl], {
                queryParams: {
                    [RouteStrings.BASE_LAYER]: this.store.selectSnapshot((s: ApplicationState) => s.layersState).selectedBaseLayerKey
                }
            });
            return Urls.baseAddress + urlTree.toString();
        }
        if (inMemoryState.shareUrl != null) {
            return this.getFullUrlFromShareId(inMemoryState.shareUrl.id);
        }
        return this.getMapAddress();
    }

    public getMapAddress() {
        const location = this.store.selectSnapshot((s: ApplicationState) => s.locationState);
        const urlTree = this.router.createUrlTree([RouteStrings.MAP,
            (location.zoom + 1).toFixed(HashService.ZOOM_PERSICION),
            location.latitude.toFixed(HashService.HIGH_PERSICION),
            location.longitude.toFixed(HashService.HIGH_PERSICION)]);
        return Urls.baseAddress + urlTree.toString();
    }

    public getFullUrlFromLatLng(latlng: LatLngAlt) {
        return this.getFullUrlFromPoiId({
            id: getIdFromLatLng(latlng),
            source: RouteStrings.COORDINATES,
            language: null
        });
    }

    public getFullUrlFromPoiId(poiSourceAndId: PoiRouterData) {
        const urlTree = this.router.createUrlTree([RouteStrings.POI, poiSourceAndId.source, poiSourceAndId.id],
            { queryParams: { language: poiSourceAndId.language } });
        return Urls.baseAddress + urlTree.toString();
    }

    public getFullUrlFromShareId(id: string) {
        const urlTree = this.router.createUrlTree([RouteStrings.SHARE, id]);
        return Urls.baseAddress + urlTree.toString();
    }
}
