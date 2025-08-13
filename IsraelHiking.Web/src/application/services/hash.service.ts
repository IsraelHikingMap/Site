import { inject, Injectable } from "@angular/core";
import { NavigationEnd, Router } from "@angular/router";
import { Store } from "@ngxs/store";
import { filter, skip } from "rxjs";

import { Urls } from "../urls";
import { MapService } from "./map.service";
import { SidebarService } from "./sidebar.service";
import { DataContainerService } from "./data-container.service";
import { FitBoundsService } from "./fit-bounds.service";
import { ShareUrlsService } from "./share-urls.service";
import { SetFileUrlAndBaseLayerAction, SetShareUrlAction } from "../reducers/in-memory.reducer";
import type { ApplicationState, LatLngAlt } from "../models";

export type PoiRouteUrlInfo = {
    source: string;
    id: string;
    language: string;
    editMode: boolean;
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

    private readonly router = inject(Router);
    private readonly mapService = inject(MapService);
    private readonly sidebarService = inject(SidebarService);
    private readonly dataContainerService = inject(DataContainerService);
    private readonly fitBoundsService = inject(FitBoundsService);
    private readonly shareUrlsService = inject(ShareUrlsService);
    private readonly store = inject(Store);

    constructor() {
        this.router.events.pipe(
            filter(event => event instanceof NavigationEnd)
          ).subscribe((event: NavigationEnd) => {
            const tree = this.router.parseUrl(event.url);
            const segments = tree.root.children.primary?.segments ?? [];
            const queryParams = tree.queryParams;
            if (this.router.url.startsWith(RouteStrings.ROUTE_MAP)) {
                this.fitBoundsService.flyTo({
                    lng: +segments[3].path,
                    lat: +segments[2].path
                }, +segments[1].path - 1);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_SHARE)) {
                this.dataContainerService.setShareUrlAfterNavigation(segments[1].path);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_URL)) {
                this.dataContainerService.setFileUrlAfterNavigation(segments[1].path,
                    queryParams[RouteStrings.BASE_LAYER]);
            } else if (this.router.url.startsWith(RouteStrings.ROUTE_POI)) {
                this.sidebarService.show("public-poi");
            } else if (this.router.url === RouteStrings.ROUTE_ROOT) {
                this.store.dispatch(new SetFileUrlAndBaseLayerAction(null, null));
                this.store.dispatch(new SetShareUrlAction(null));
                this.sidebarService.hide();
            }
        });
    }

    public initialize(): void {
        this.store.select((state: ApplicationState) => state.inMemoryState.fileUrl).pipe(skip(1)).subscribe(() => {
            this.resetAddressbar();
        });
        this.store.select((state: ApplicationState) => state.inMemoryState.shareUrl).pipe(skip(1)).subscribe(() => {
            this.resetAddressbar();
        });
        this.store.select((state: ApplicationState) => state.poiState.selectedPointOfInterest).pipe(skip(1)).subscribe(() => {
            this.resetAddressbar();
        });
        this.store.select((state: ApplicationState) => state.locationState).pipe(skip(1)).subscribe(() => {
            this.resetAddressbar();
        });
    }

    private resetAddressbar(): void {
        if (this.sidebarService.viewName === "public-poi") {
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
            return this.shareUrlsService.getFullUrlFromShareId(inMemoryState.shareUrl.id);
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
            language: null,
            editMode: false
        });
    }

    public getFullUrlFromPoiId(poiSourceAndId: PoiRouteUrlInfo) {
        const urlTree = this.router.createUrlTree([RouteStrings.POI, poiSourceAndId.source, poiSourceAndId.id],
            { queryParams: { language: poiSourceAndId.language } });
        return Urls.baseAddress + urlTree.toString();
    }
}
