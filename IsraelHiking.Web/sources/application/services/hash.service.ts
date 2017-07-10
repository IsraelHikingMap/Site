import { Injectable, Inject } from "@angular/core";
import * as Common from "../common/IsraelHiking";
import { MapService } from "./map.service";
import { URLSearchParams } from "@angular/http";
import { Router, NavigationEnd } from "@angular/router";


@Injectable()
export class HashService {

    private static PERSICION = 4;
    private static BASE_LAYER = "baselayer";
    private static URL = "url";
    private static DOWNLOAD = "download";
    private static SITE_SHARE = "s";
    private static SEARCH_QUERY = "q";

    private window: Window;
    private baseLayer: Common.LayerData;

    public searchTerm: string;
    public externalUrl: string;
    public siteUrl: string;
    public download: boolean;

    constructor(private router: Router,
        @Inject("Window") window: any, // bug in angular aot
        private mapService: MapService) {

        this.baseLayer = null;
        this.searchTerm = "";
        this.window = window;
        this.addDataFromUrl();
        this.updateUrl();

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                let latLng = this.parsePathToGeoLocation();
                if (latLng == null) {
                    this.window.location.reload();
                    return;
                }
                this.mapService.map.setView(latLng, latLng.alt);
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
        var path = "/#!/" + this.mapService.map.getZoom() +
            "/" + this.mapService.map.getCenter().lat.toFixed(HashService.PERSICION) +
            "/" + this.mapService.map.getCenter().lng.toFixed(HashService.PERSICION);
        this.router.navigateByUrl(path, { replaceUrl: true });
    }

    private stringToBaseLayer(addressOrKey: string): Common.LayerData {
        if (addressOrKey.indexOf("www") !== -1 || addressOrKey.indexOf("http") !== -1) {
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

    private addDataFromUrl() {
        let searchParams = new URLSearchParams(this.window.location.hash.replace("#!/?", ""));
        this.searchTerm = decodeURIComponent(searchParams.get(HashService.SEARCH_QUERY) || "");
        this.externalUrl = searchParams.get(HashService.URL) || "";
        this.siteUrl = searchParams.get(HashService.SITE_SHARE) || "";
        this.download = searchParams.has(HashService.DOWNLOAD);
        this.baseLayer = this.stringToBaseLayer(searchParams.get(HashService.BASE_LAYER) || "");
        let latLng = this.parsePathToGeoLocation();
        if (latLng != null) {
            this.mapService.map.setView(latLng, latLng.alt);
        }
    }

    private parsePathToGeoLocation(): L.LatLng {
        var path = this.window.location.hash;
        var splittedpath = path.split("/");
        if (splittedpath.length !== 4) {
            return null;
        }
        return L.latLng(
            parseFloat(splittedpath[splittedpath.length - 2]),
            parseFloat(splittedpath[splittedpath.length - 1]),
            parseInt(splittedpath[splittedpath.length - 3])
        );
    }
} 