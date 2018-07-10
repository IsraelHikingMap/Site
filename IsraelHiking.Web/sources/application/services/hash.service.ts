import { Injectable, Inject } from "@angular/core";
import { HttpParams } from "@angular/common/http";
import { Router } from "@angular/router";
import { Subject } from "rxjs";
import * as L from "leaflet";

import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

export type ApplicationStateType = "download" | "search" | "share" | "url" | "baseLayer" | "poi";

export interface IApplicationStateChangedEventArgs {
    type: ApplicationStateType;
    value: any;
}

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
    public static readonly SEARCH = "search";
    public static readonly ROUTE_ROOT = "/";
    public static readonly ROUTE_MAP = `/${RouteStrings.MAP}`;
    public static readonly ROUTE_SHARE = `/${RouteStrings.SHARE}`;
    public static readonly ROUTE_URL = `/${RouteStrings.URL}`;
    public static readonly ROUTE_POI = `/${RouteStrings.POI}`;
    public static readonly ROUTE_DOWNLOAD = `/${RouteStrings.DOWNLOAD}`;
    public static readonly ROUTE_SEARCH = `/${RouteStrings.SEARCH}`;

    public static readonly LAT = "lat";
    public static readonly LON = "lon";
    public static readonly ZOOM = "zoom";
    public static readonly ID = "id";
    public static readonly SOURCE = "source";
    public static readonly TERM = "term";
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
    private static readonly SEARCH_QUERY = "q";
    private static readonly HASH = "#!/";
    private static readonly LOCATION_REGEXP = /\/(\d+)\/([-+]?[0-9]*\.?[0-9]+)\/([-+]?[0-9]*\.?[0-9]+)/;

    private readonly window: Window;
    private readonly stateMap: Map<ApplicationStateType, any>;

    public applicationStateChanged: Subject<IApplicationStateChangedEventArgs>;

    constructor(private readonly router: Router,
        @Inject("Window") window: any, // bug in angular aot
        private readonly resources: ResourcesService,
        private readonly mapService: MapService) {

        this.window = window;
        this.applicationStateChanged = new Subject();
        this.stateMap = new Map();
        this.backwardCompatibilitySupport();
        this.mapService.map.on("moveend", () => {
            if (this.getShareUrlId() || this.getUrl() || this.stateMap.get("poi")) {
                return;
            }
            this.resetAddressbar();
        });
    }

    public resetAddressbar(): void {
        if (this.getShareUrlId()) {
            this.router.navigate([RouteStrings.ROUTE_SHARE, this.getShareUrlId()], { replaceUrl: true });
            return;
        }
        if (this.getUrl()) {
            let queryParams = {} as any;
            let baseLayer = this.baseLayerToString(this.getBaselayer());
            if (baseLayer) {
                queryParams.baselayer = baseLayer;
            }
            this.router.navigate([RouteStrings.ROUTE_URL, this.getUrl()],
                { queryParams: queryParams, replaceUrl: true });
            return;
        }
        this.router.navigate([
                RouteStrings.ROUTE_MAP,
                this.mapService.map.getZoom(),
                this.mapService.map.getCenter().lat.toFixed(HashService.PERSICION),
                this.mapService.map.getCenter().lng.toFixed(HashService.PERSICION)
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
        let searchTerm = searchParams.get(HashService.SEARCH_QUERY);
        if (searchTerm) {
            this.router.navigate([RouteStrings.ROUTE_SEARCH, searchTerm], { queryParams: { baselayer: baseLayer }, replaceUrl: true });
            return;
        }
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

    private parsePathToGeoLocation(): L.LatLng {
        let path = this.window.location.hash;
        if (!HashService.LOCATION_REGEXP.test(path)) {
            return null;
        }
        let array = HashService.LOCATION_REGEXP.exec(path);
        return L.latLng(
            +array[2],
            +array[3],
            +array[1]
        );
    }

    public getHref(): string {
        if (this.getUrl() != null) {
            let urlTree = this.router.createUrlTree([RouteStrings.URL, this.stateMap.get("url")]);
            return this.window.location.origin + urlTree.toString();
        }
        if (this.getShareUrlId() != null) {
            return this.getFullUrlFromShareId(this.stateMap.get("share"));
        }
        return Urls.baseAddress;
    }

    public getShareUrlId(): string {
        return this.stateMap.get("share");
    }

    public getUrl(): string {
        return this.stateMap.get("url");
    }

    public getBaselayer(): Common.LayerData {
        return this.stateMap.get("baseLayer");
    }

    public getPoiRouterData(): IPoiRouterData {
        return this.stateMap.get("poi");
    }

    public getFullUrlFromPoiId(poiSourceAndId: IPoiRouterData) {
        let urlTree = this.router.createUrlTree([RouteStrings.POI, poiSourceAndId.source, poiSourceAndId.id],
            { queryParams: { language: poiSourceAndId.language } });
        return this.window.location.origin + urlTree.toString();
    }

    public getFullUrlFromShareId(id: string) {
        let urlTree = this.router.createUrlTree([RouteStrings.SHARE, id]);
        return this.window.location.origin + urlTree.toString();
    }

    public setApplicationState(type: ApplicationStateType, value: any) {
        this.stateMap.set(type, value);
        this.applicationStateChanged.next({ type: type, value: value });
    }

    public stringToBaseLayer(addressOrKey: string): Common.LayerData {
        if (!addressOrKey) {
            return null;
        }
        if (addressOrKey.includes("www") || addressOrKey.includes("http")) {
            return {
                key: "",
                address: addressOrKey
            } as Common.LayerData;
        }
        return {
            key: addressOrKey.split("_").join(" "),
            address: ""
        } as Common.LayerData;
    }

    private baseLayerToString(baeLayer: Common.LayerData): string {
        if (baeLayer == null) {
            return null;
        }
        if (baeLayer.address) {
            return baeLayer.address;
        }
        return baeLayer.key.split(" ").join("_");
    }
}
