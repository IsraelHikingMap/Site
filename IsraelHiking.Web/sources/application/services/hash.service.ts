﻿import { Injectable, Inject } from "@angular/core";
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
    private static readonly LOCATION_REGEXP = /\/(\d+)\/(\d+\.\d+)\/(\d+\.\d+)/;

    private window: Window;
    private baseLayer: Common.LayerData;
    private shareUrlId: string;
    private internalUpdate: boolean;

    public searchTerm: string;
    public externalUrl: string;
    public download: boolean;

    constructor(private router: Router,
        @Inject("Window") window: any, // bug in angular aot
        private mapService: MapService) {

        this.baseLayer = null;
        this.searchTerm = "";
        this.window = window;
        this.internalUpdate = false;
        this.initialLoad();
        this.updateUrl();

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                let latLng = this.parsePathToGeoLocation();
                if (latLng == null) {
                    this.window.location.reload();
                    return;
                }
                if (this.internalUpdate === false) {
                    this.onExternalUpdate();
                }
                this.internalUpdate = false;
            }
        });

        this.mapService.map.on("moveend", () => {
            this.internalUpdate = true;
            this.updateUrl();
        });
    }

    public getBaseLayer(): Common.LayerData {
        return this.baseLayer;
    }

    private updateUrl = () => {
        var path = HashService.HASH;
        if (this.shareUrlId) {
            path += HashService.getShareUrlPostfix(this.shareUrlId);
        }
        else
        {
            path += "/" + this.mapService.map.getZoom() +
            "/" + this.mapService.map.getCenter().lat.toFixed(HashService.PERSICION) +
            "/" + this.mapService.map.getCenter().lng.toFixed(HashService.PERSICION);
        }
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
        let searchParams = this.getSearchParams();
        this.searchTerm = decodeURIComponent(searchParams.get(HashService.SEARCH_QUERY) || "");
        this.externalUrl = searchParams.get(HashService.URL) || "";
        this.download = searchParams.has(HashService.DOWNLOAD);
        this.baseLayer = this.stringToBaseLayer(searchParams.get(HashService.BASE_LAYER) || "");
        this.onExternalUpdate(searchParams);
    }

    private getSearchParams() {
        let simplifiedHash = this.window.location.hash.replace(HashService.LOCATION_REGEXP, "").replace("#!/?", "");
        return new HttpParams({ fromString: simplifiedHash });
    }

    private onExternalUpdate(searchParams?) {
        if (!searchParams) {
            searchParams = this.getSearchParams();
        }
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
            parseFloat(array[2]),
            parseFloat(array[3]),
            parseInt(array[1])
        );
    }

    public getLinkBackToSite() {
        if (!this.window.frameElement) {
            return Urls.baseAddress;
        }
        if (this.externalUrl) {
            return `${Urls.baseAddress}${HashService.HASH}/?${HashService.URL}=${this.externalUrl}`;
        }
        if (this.shareUrlId) {
            return HashService.getFullUrlFromShareId(this.shareUrlId);
        }
        return Urls.baseAddress;
    }

    public getShareUrlId(): string {
        return this.shareUrlId;
    }

    public setShareUrlId(shareUrlId: string) {
        this.shareUrlId = shareUrlId;
        this.updateUrl();
    }

    public static getShareUrlPostfix(id: string) {
        return `/?${HashService.SITE_SHARE}=${id}`;
    }

    public static getFullUrlFromShareId(id: string) {
        return `${Urls.baseAddress}${HashService.HASH}${HashService.getShareUrlPostfix(id)}`;
    }
} 
