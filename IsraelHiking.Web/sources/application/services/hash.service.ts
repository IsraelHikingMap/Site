import { Injectable, Inject } from "@angular/core";
import { HttpParams } from "@angular/common/http";
import { Router } from "@angular/router";
import { NgRedux } from "@angular-redux/store";

import { Urls } from "../urls";
import { LatLngAlt, ApplicationState } from "../models/models";

export interface IPoiRouterData {
    source: string;
    id: string;
    language: string;
}

export class RouteStrings {
    public static readonly MAP = "map";
    public static readonly SHARE = "share";
    public static readonly URL = "url";
    public static readonly POI = "poi";
    public static readonly DOWNLOAD = "download";
    public static readonly ROUTE_ROOT = "/";
    public static readonly ROUTE_MAP = `/${RouteStrings.MAP}`;
    public static readonly ROUTE_SHARE = `/${RouteStrings.SHARE}`;
    public static readonly ROUTE_URL = `/${RouteStrings.URL}`;
    public static readonly ROUTE_POI = `/${RouteStrings.POI}`;
    public static readonly ROUTE_DOWNLOAD = `/${RouteStrings.DOWNLOAD}`;

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
    private static readonly BASE_LAYER = "baselayer";
    private static readonly URL = "url";
    private static readonly DOWNLOAD = "download";
    private static readonly SITE_SHARE = "s";
    private static readonly HASH = "#!/";
    private static readonly LOCATION_REGEXP = /\/(\d+)\/([-+]?[0-9]*\.?[0-9]+)\/([-+]?[0-9]*\.?[0-9]+)/;

    private readonly window: Window;

    constructor(private readonly router: Router,
        @Inject("Window") window: any, // bug in angular aot
        private readonly ngRedux: NgRedux<ApplicationState>) {

        this.window = window;
        this.backwardCompatibilitySupport();
    }

    public resetAddressbar(): void {
        let state = this.ngRedux.getState();
        if (state.poiState.isSidebarOpen) {
            return;
        }
        let inMemoryState = state.inMemoryState;
        if (inMemoryState.shareUrl) {
            this.router.navigate([RouteStrings.ROUTE_SHARE, inMemoryState.shareUrl.id], { replaceUrl: true });
            return;
        }
        if (inMemoryState.fileUrl) {
            let queryParams = {} as any;
            if (inMemoryState.baseLayer) {
                queryParams.baselayer = inMemoryState.baseLayer;
            }
            this.router.navigate([RouteStrings.ROUTE_URL, inMemoryState.fileUrl],
                { queryParams: queryParams, replaceUrl: true });
            return;
        }
        let location = this.ngRedux.getState().location;
        this.router.navigate([
                RouteStrings.ROUTE_MAP,
                location.zoom,
                location.latitude.toFixed(HashService.PERSICION),
                location.longitude.toFixed(HashService.PERSICION)
            ],
            { replaceUrl: true });
    }

    private backwardCompatibilitySupport() {
        if (this.window.location.hash.indexOf(HashService.HASH) < 0) {
            return;
        }
        let simplifiedHash = this.window.location.hash.replace(HashService.LOCATION_REGEXP, "").replace(`${HashService.HASH}?`, "");
        let searchParams = new HttpParams({ fromString: simplifiedHash });
        let baseLayer = searchParams.get(HashService.BASE_LAYER);
        let externalUrl = searchParams.get(HashService.URL);
        if (externalUrl) {
            this.router.navigate([RouteStrings.ROUTE_URL, externalUrl], { queryParams: { baselayer: baseLayer }, replaceUrl: true });
            return;
        }
        let download = searchParams.has(HashService.DOWNLOAD);
        if (download) {
            this.router.navigate([RouteStrings.ROUTE_DOWNLOAD], { replaceUrl: true });
            return;
        }
        let shareUrlId = searchParams.get(HashService.SITE_SHARE);
        if (shareUrlId) {
            this.router.navigate([RouteStrings.ROUTE_SHARE, shareUrlId], { replaceUrl: true });
            return;
        }
        let latLng = this.parsePathToGeoLocation();
        if (latLng != null) {
            this.router.navigate([RouteStrings.ROUTE_MAP, latLng.alt, latLng.lat, latLng.lng], { replaceUrl: true });
            return;
        }
        // no flags - navigate to root
        this.router.navigate([RouteStrings.ROUTE_ROOT], { replaceUrl: true });
    }

    private parsePathToGeoLocation(): LatLngAlt {
        let path = this.window.location.hash;
        if (!HashService.LOCATION_REGEXP.test(path)) {
            return null;
        }
        let array = HashService.LOCATION_REGEXP.exec(path);
        return {
            lat: +array[2],
            lng: +array[3],
            alt: +array[1]
        };
    }

    public getHref(): string {
        let inMemoryState = this.ngRedux.getState().inMemoryState;
        if (inMemoryState.fileUrl != null) {
            let urlTree = this.router.createUrlTree([RouteStrings.URL, inMemoryState.fileUrl]);
            return Urls.baseAddress + urlTree.toString();
        }
        if (inMemoryState.shareUrl != null) {
            return this.getFullUrlFromShareId(inMemoryState.shareUrl.id);
        }
        return Urls.baseAddress;
    }

    public getFullUrlFromPoiId(poiSourceAndId: IPoiRouterData) {
        let urlTree = this.router.createUrlTree([RouteStrings.POI, poiSourceAndId.source, poiSourceAndId.id],
            { queryParams: { language: poiSourceAndId.language } });
        return Urls.baseAddress + urlTree.toString();
    }

    public getFullUrlFromShareId(id: string) {
        let urlTree = this.router.createUrlTree([RouteStrings.SHARE, id]);
        return Urls.baseAddress + urlTree.toString();
    }
}
