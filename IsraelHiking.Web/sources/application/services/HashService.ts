﻿import { Injectable } from "@angular/core";
import * as Common from "../common/IsraelHiking";
import { MapService } from "./MapService";
import { URLSearchParams } from "@angular/http";
import { Router, NavigationEnd } from "@angular/router";
import { Location, LocationStrategy, PathLocationStrategy } from "@angular/common";


@Injectable()
export class HashService {
    public static MARKERS = "markers";
    public static MAP_LOCATION_CHANGED = "mapLocationChanged";

    private static ARRAY_DELIMITER = ";";
    private static SPILT_REGEXP = /[:;]+/;
    private static MARKER_SPECIAL_CHARACTERS_REGEXP = /[:;,]+/;
    private static DATA_DELIMITER = ",";
    private static PERSICION = 4;
    private static BASE_LAYER = "baselayer";
    private static URL = "url";
    private static DOWNLOAD = "download";
    private static SITE_SHARE = "s";
    private static SEARCH_QUERY = "q";

    private dataContainer: Common.DataContainer;
    private changingAddress: boolean;

    public searchTerm: string;
    public externalUrl: string;
    public siteUrl: string;
    public download: boolean;

    constructor(private router: Router,
        private location: Location,
        private mapService: MapService) {

        this.dataContainer = { routes: [] } as Common.DataContainer;
        this.searchTerm = "";
        this.changingAddress = false;
        this.addDataFromUrl();
        this.updateUrl();

        this.router.events.subscribe((event) => {
            if (event instanceof NavigationEnd) {
                let latLng = this.parsePathToGeoLocation();
                if (latLng == null) {
                    window.location.reload();
                    return;
                }
                this.mapService.map.setView(latLng, latLng.alt);
            }
        });

        this.mapService.map.on("moveend", () => {
            this.updateUrl();
        });
    }

    public getDataContainer = (): Common.DataContainer => {
        return this.dataContainer;
    }

    private updateUrl = () => {
        var path = "/#!/" + this.mapService.map.getZoom() +
            "/" + this.mapService.map.getCenter().lat.toFixed(HashService.PERSICION) +
            "/" + this.mapService.map.getCenter().lng.toFixed(HashService.PERSICION);
        this.changingAddress = this.location.path() !== path;
        this.router.navigateByUrl(path, { replaceUrl: true });
    }

    public clear = () => {
        // HM TODO: fix this - should remove all query parameters
        if (this.siteUrl) {
            this.location.replaceState(this.location.path(true), `${HashService.SITE_SHARE}=${this.siteUrl}`);
        } else {
            this.location.replaceState(this.location.path(true));
        }
    }

    private stringToRoute = (data: string, name: string): Common.RouteData => {
        return {
            name: name,
            segments: this.stringToRouteSegments(data),
            markers: []
        } as Common.RouteData;
    }

    private stringArrayToMarkers(stringArray: string[]): Common.MarkerData[] {
        var array = [] as Common.MarkerData[];
        for (let srtingIndex = 0; srtingIndex < stringArray.length; srtingIndex++) {
            var markerStringSplit = stringArray[srtingIndex].split(HashService.DATA_DELIMITER);
            if (markerStringSplit.length < 2) {
                continue;
            }
            let title = "";
            if (markerStringSplit.length >= 3) {
                title = markerStringSplit[2];
            }
            array.push({
                latlng: new L.LatLng(parseFloat(markerStringSplit[0]), parseFloat(markerStringSplit[1])),
                title: title,
                type: ""
            });
        }
        return array;
    }

    private stringToRouteSegments = (data: string): Common.RouteSegmentData[] => {
        var splitted = data.split(HashService.SPILT_REGEXP);
        var array = [] as Common.RouteSegmentData[];
        for (let pointString of splitted) {
            var pointStrings = pointString.split(HashService.DATA_DELIMITER);
            if (pointStrings.length === 3) {
                let latLng = L.latLng(parseFloat(pointStrings[1]), parseFloat(pointStrings[2]), 0);
                array.push({
                    latlngs: [latLng, latLng],
                    routePoint: latLng,
                    routingType: this.convertCharacterToRoutingType(pointStrings[0])
                } as Common.RouteSegmentData);
            }
        }
        return array;
    }

    private convertCharacterToRoutingType(routingTypeCharacter: string): Common.RoutingType {
        switch (routingTypeCharacter) {
            case "h":
                return "Hike";
            case "b":
                return "Bike";
            case "f":
                return "4WD";
            case "n":
                return "None";
            default:
                return "Hike";
        }
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

    private urlStringToDataContainer(urlSearchParams: URLSearchParams): Common.DataContainer {
        let data = {
            routes: []
        } as Common.DataContainer;
        let markers = [] as Common.MarkerData[];
        urlSearchParams.paramsMap.forEach((value, key) => {
            if (key.startsWith("#!/")) {
                return;
            }
            if (key.toLocaleLowerCase() === HashService.URL) {
                return;
            }
            if (key.toLocaleLowerCase() === HashService.SITE_SHARE) {
                return;
            }
            if (key.toLocaleLowerCase() === HashService.SEARCH_QUERY) {
                return;
            }
            if (key.toLocaleLowerCase() === HashService.DOWNLOAD) {
                return;
            }
            if (key === HashService.MARKERS) {
                markers = this.stringArrayToMarkers(urlSearchParams.get(key).split(HashService.SPILT_REGEXP) || []);
                return;
            }
            if (key === HashService.BASE_LAYER) {
                data.baseLayer = this.stringToBaseLayer(urlSearchParams.get(key) || "");
            }
            data.routes.push(this.stringToRoute(urlSearchParams.get(key), key.split("_").join(" ")));
        });
        if (markers.length > 0) {
            if (data.routes.length === 0) {
                let name = markers.length === 1 ? markers[0].title || HashService.MARKERS : HashService.MARKERS;
                data.routes.push({
                    name: name,
                    segments: [],
                    markers: []
                });
            }
            data.routes[0].markers = markers;
        }
        return data;
    }

    private addDataFromUrl() {
        let searchParams = new URLSearchParams(window.location.hash.replace("#!/?", ""));
        this.searchTerm = searchParams.get(HashService.SEARCH_QUERY) || "";
        this.externalUrl = searchParams.get(HashService.URL) || "";
        this.siteUrl = searchParams.get(HashService.SITE_SHARE) || "";
        this.download = searchParams.has(HashService.DOWNLOAD) ? true : false;
        let latLng = this.parsePathToGeoLocation();
        if (latLng != null) {
            this.mapService.map.setView(latLng, latLng.alt);
        }
        this.dataContainer = this.urlStringToDataContainer(searchParams);
    }

    private parsePathToGeoLocation(): L.LatLng {
        var path = this.location.path(true);
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