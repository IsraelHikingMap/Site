import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { Map } from "mapbox-gl";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../urls";
import { SpatialService } from "./spatial.service";
import { LatLngAlt, MarkerData } from "../models/models";

export interface ISnappingRouteOptions {
    lines: LatLngAlt[][];
    /**
     * The sensitivity of snapping in pixels
     */
    sensitivity: number;
}

export interface ISnappingBaseResponse {
    latlng: LatLngAlt;
}

export interface ISnappingRouteResponse extends ISnappingBaseResponse {
    lineIndex: number;
    line: LatLngAlt[];
}

export interface ISnappingPointOptions {
    points: MarkerData[];
    /**
     * The sensitivity of snapping in pixels
     */
    sensitivity: number;
}

export interface ISnappingPointResponse extends ISnappingBaseResponse {
    markerData: MarkerData;
}

interface ISnappingRequestQueueItem {
    boundsString: string;
}

@Injectable()
export class SnappingService {
    private static readonly DEFAULT_SENSITIVITY = 10;

    private highwaySnappings: LatLngAlt[][];
    private pointsSnappings: MarkerData[];
    private enabled: boolean;
    private requestsQueue: ISnappingRequestQueueItem[];
    private map: Map;

    constructor(private readonly httpClient: HttpClient,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService,
                private readonly geoJsonParser: GeoJsonParser
    ) {
        this.resources = resources;
        this.highwaySnappings = [];
        this.pointsSnappings = [];
        this.enabled = false;
        this.requestsQueue = [];
    }

    public setMap(map: Map) {
        this.map = map;
        this.map.on("moveend",
            () => {
                this.generateSnappings();
            });
    }

    private generateSnappings = async () => {
        if (!this.map) {
            return;
        }
        if (this.map.getZoom() <= 12 || this.enabled === false) {
            this.highwaySnappings.splice(0);
            this.pointsSnappings.splice(0);
            return;
        }

        let bounds = SpatialService.getMapBounds(this.map);
        let boundsString = [
                bounds.southWest.lat,
                bounds.southWest.lng,
                bounds.northEast.lat,
                bounds.northEast.lng
            ]
            .join(",");
        this.requestsQueue.push({
            boundsString
        } as ISnappingRequestQueueItem);
        let params = new HttpParams()
            .set("northEast", bounds.northEast.lat + "," + bounds.northEast.lng)
            .set("southWest", bounds.southWest.lat + "," + bounds.southWest.lng);
        try {
            let features = await this.httpClient.get(Urls.osm, { params }).toPromise() as GeoJSON.Feature<GeoJSON.GeometryObject>[];
            let queueItem = this.requestsQueue.find((itemToFind) => itemToFind.boundsString === boundsString);
            if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                return;
            }
            this.highwaySnappings.splice(0);
            this.pointsSnappings.splice(0);
            for (let feature of features) {
                let latlngsArrays = this.geoJsonParser.toLatLngsArray(feature);
                for (let latlngsArray of latlngsArrays) {
                    if (latlngsArray.length > 1) {
                        this.highwaySnappings.push(latlngsArray);
                    } else {
                        let dataContainer = this.geoJsonParser.toDataContainer({
                                features: [feature],
                                type: "FeatureCollection"
                            },
                            this.resources.getCurrentLanguageCodeSimplified());
                        let markerData = dataContainer.routes[0].markers[0];
                        this.pointsSnappings.push(markerData);
                    }
                }
            }
            this.requestsQueue.splice(0);
        } catch (ex) {
            this.toastService.warning(this.resources.unableToGetDataForSnapping);
            this.highwaySnappings.splice(0);
            this.pointsSnappings.splice(0);
        }
    }

    public snapToRoute = (latlng: LatLngAlt, options?: ISnappingRouteOptions): ISnappingRouteResponse => {
        if (!options) {
            options = {
                lines: this.highwaySnappings,
                sensitivity: SnappingService.DEFAULT_SENSITIVITY
            } as ISnappingRouteOptions;
        }
        let minDistance = Infinity;
        let response = {
            latlng,
            line: null
        } as ISnappingRouteResponse;

        let pointInPixels = this.map.project(latlng);
        for (let lineIndex = 0; lineIndex < options.lines.length; lineIndex++) {
            let line = options.lines[lineIndex];
            if (line.length <= 1) {
                continue;
            }
            let lineInPixels = line.map(l => this.map.project(l)).map(p => [p.x, p.y] as [number, number]);
            let distance = SpatialService.getDistanceFromPointToLine([pointInPixels.x, pointInPixels.y], lineInPixels);
            if (distance <= options.sensitivity && distance < minDistance) {
                minDistance = distance;
                response.latlng = SpatialService.getClosestPoint(latlng, line);
                response.line = line;
                response.lineIndex = lineIndex;
            }
        }
        return response;
    }

    /**
     * This method will snap to the nearest point. markerData will be null in case there were no points near by.
     */
    public snapToPoint = (latlng: LatLngAlt, options?: ISnappingPointOptions): ISnappingPointResponse => {
        let defaultOptions = {
            points: this.pointsSnappings,
            sensitivity: 2 * SnappingService.DEFAULT_SENSITIVITY
        } as ISnappingPointOptions;
        options = Object.assign(defaultOptions, options);

        let response = {
            latlng,
            markerData: null,
            id: null
        } as ISnappingPointResponse;
        let pointOnScreen = this.map.project(latlng);
        for (let markerData of options.points) {
            let markerPointOnScreen = this.map.project(markerData.latlng);
            if (SpatialService.getDistanceForCoordinates([markerPointOnScreen.x, markerPointOnScreen.y],
                [pointOnScreen.x, pointOnScreen.y]) < options.sensitivity &&
                response.markerData == null) {
                response.latlng = markerData.latlng;
                response.markerData = markerData;
            } else if (response.markerData != null
                && SpatialService.getDistanceInMeters(response.markerData.latlng, latlng) >
                SpatialService.getDistanceInMeters(markerData.latlng, latlng)) {
                response.latlng = markerData.latlng;
                response.markerData = markerData;
            }
        }
        return response;
    }

    public enable = async (enable: boolean) => {
        this.enabled = enable;
        if (this.enabled) {
            await this.generateSnappings();
        }
    }

    public isEnabled = (): boolean => {
        return this.enabled;
    }

    public async getClosestPoint(location: LatLngAlt): Promise<MarkerData> {
        let params = new HttpParams()
            .set("location", location.lat + "," + location.lng);
        let feature = await this.httpClient.get(Urls.osmClosest, { params }).toPromise() as GeoJSON.Feature<GeoJSON.GeometryObject>;
        if (feature == null) {
            return null;
        }
        let dataContainer = this.geoJsonParser.toDataContainer({
                features: [feature],
                type: "FeatureCollection"
            },
            this.resources.getCurrentLanguageCodeSimplified());
        let markerData = dataContainer.routes[0].markers[0];
        return markerData;
    }
}
