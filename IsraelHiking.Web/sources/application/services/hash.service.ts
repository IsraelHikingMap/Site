import { Injectable, Inject } from "@angular/core";
import { HttpParams } from "@angular/common/http";
import { Router, NavigationEnd } from "@angular/router";
import * as L from "leaflet";

import { MapService } from "./map.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

@Injectable()
export class HashService {

    private static readonly PERSICION = 4;
    private static readonly BASE_LAYER = "baselayer";
    private static readonly URL = "url";
    private static readonly DOWNLOAD = "download";
    private static readonly SITE_SHARE = "s";
    private static readonly SEARCH_QUERY = "q";
    private static readonly HASH = "/#!";
    private static readonly LOCATION_REGEXP = /\/(\d+)\/([-+]?[0-9]*\.?[0-9]+)\/([-+]?[0-9]*\.?[0-9]+)/;

    private window: Window;
    private baseLayer: Common.LayerData;
    private shareUrlId: string;
    private internalUpdate: boolean;

    public searchTerm: string;
    public externalUrl: string;
    public download: boolean;

    public static getShareUrlPostfix(id: string) {
        return `/?${HashService.SITE_SHARE}=${id}`;
    }

    public static getFullUrlFromShareId(id: string) {
        return `${Urls.baseAddress}${HashService.HASH}${HashService.getShareUrlPostfix(id)}`;
    }

    constructor(private readonly router: Router,
        @Inject("Window") window: any, // bug in angular aot
        private readonly mapService: MapService) {

        this.baseLayer = null;
        this.searchTerm = "";
        this.window = window;
        this.internalUpdate = true; // this is due to the fact that nviagtion end is called once the site finishes loading.
        this.initialLoad();
        this.updateUrl();

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                if (this.internalUpdate) {
                    this.internalUpdate = false;
                    return;
                }
                let latLng = this.parsePathToGeoLocation();
                if (latLng != null) {
                    this.externalUrl = "";
                    this.shareUrlId = "";
                    this.mapService.map.flyTo(latLng, latLng.alt);
                } else {
                    this.window.location.reload();
                }
            }
        });

        this.mapService.map.on("moveend", () => {
            this.updateUrl();
        });
    }

    public getBaseLayer(): Common.LayerData {
        return this.baseLayer;
    }

    private updateUrl = () => {
        if (this.shareUrlId || this.externalUrl) {
            return;
        }
        let path = HashService.HASH + "/" + this.mapService.map.getZoom() +
            "/" + this.mapService.map.getCenter().lat.toFixed(HashService.PERSICION) +
            "/" + this.mapService.map.getCenter().lng.toFixed(HashService.PERSICION);
        this.internalUpdate = true;
        this.router.navigateByUrl(path, { replaceUrl: true });
    }

    private stringToBaseLayer(addressOrKey: string): Common.LayerData {
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

    private initialLoad() {
        let simplifiedHash = this.window.location.hash.replace(HashService.LOCATION_REGEXP, "").replace("#!/?", "");
        let searchParams = new HttpParams({ fromString: simplifiedHash });
        this.searchTerm = decodeURIComponent(searchParams.get(HashService.SEARCH_QUERY) || "");
        this.externalUrl = searchParams.get(HashService.URL) || "";
        this.download = searchParams.has(HashService.DOWNLOAD);
        this.baseLayer = this.stringToBaseLayer(searchParams.get(HashService.BASE_LAYER) || "");
        this.shareUrlId = searchParams.get(HashService.SITE_SHARE) || "";
        let latLng = this.parsePathToGeoLocation();
        if (latLng != null) {
            this.mapService.map.setView(latLng, latLng.alt);
        }
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

    public openNewTab() {
        let url = Urls.baseAddress;
        if (this.externalUrl) {
            url = `${Urls.baseAddress}${HashService.HASH}/?${HashService.URL}=${this.externalUrl}`;
        }
        if (this.shareUrlId) {
            url = HashService.getFullUrlFromShareId(this.shareUrlId);
        }
        this.window.open(url);
    }

    public getShareUrlId(): string {
        return this.shareUrlId;
    }

    public setShareUrlId(shareUrlId: string) {
        this.shareUrlId = shareUrlId;
        this.internalUpdate = true;
        this.router.navigateByUrl(`${HashService.HASH}${HashService.getShareUrlPostfix(this.shareUrlId)}`);
    }
}
