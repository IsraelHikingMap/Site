import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { GeoJsonParser } from "./geojson.parser";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";


export interface ISnappingRouteOptions {
    polylines: L.Polyline[];
    /**
     * The sensivitivity of snappings in pixels
     */
    sensitivity: number;
}

export interface ISnappingBaseResponse {
    latlng: L.LatLng;
}

export interface ISnappingRouteResponse extends ISnappingBaseResponse {
    polyline: L.Polyline;
    beforeIndex: number;
}

export interface ISnappingPointOptions {
    points: Common.MarkerData[];
    /**
     * The sensivitivity of snappings in pixels
     */
    sensitivity: number;
}

export interface ISnappingPointResponse extends ISnappingBaseResponse {
    markerData: Common.MarkerData;
}

interface ISnappingRequestQueueItem {
    boundsString: string;
}

@Injectable()
export class SnappingService {
    private static readonly DEFAULT_SENSITIVITY = 10;

    private highwaySnappings: L.Polyline[];
    private pointsSnappings: Common.MarkerData[];
    private enabled: boolean;
    private requestsQueue: ISnappingRequestQueueItem[];

    constructor(private readonly httpClient: HttpClient,
        private readonly resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly toastService: ToastService,
        private readonly geoJsonParser: GeoJsonParser
    ) {
        this.resources = resources;
        this.highwaySnappings = [];
        this.pointsSnappings = [];
        this.enabled = false;
        this.requestsQueue = [];
        this.mapService.map.on("moveend", () => {
            this.generateSnappings();
        });
    }

    private generateSnappings = async () => {
        if (this.mapService.map.getZoom() <= 13 || this.enabled === false) {
            this.highwaySnappings.splice(0);
            this.pointsSnappings.splice(0);
            return;
        }

        let bounds = this.mapService.map.getBounds();
        let boundsString = [
                bounds.getSouthWest().lat,
                bounds.getSouthWest().lng,
                bounds.getNorthEast().lat,
                bounds.getNorthEast().lng
            ]
            .join(",");
        this.requestsQueue.push({
            boundsString: boundsString
        } as ISnappingRequestQueueItem);
        let params = new HttpParams()
            .set("northEast", bounds.getNorthEast().lat + "," + bounds.getNorthEast().lng)
            .set("southWest", bounds.getSouthWest().lat + "," + bounds.getSouthWest().lng);
        try {
            let features = await this.httpClient.get(Urls.osm, { params: params }).toPromise() as GeoJSON.Feature<GeoJSON.GeometryObject>[];
            let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.boundsString === boundsString);
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
                        this.highwaySnappings.push(L.polyline(latlngsArray, { opacity: 0 } as L.PolylineOptions));
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

    public snapToRoute = (latlng: L.LatLng, options?: ISnappingRouteOptions): ISnappingRouteResponse => {
        if (!options) {
            options = {
                polylines: this.highwaySnappings,
                sensitivity: SnappingService.DEFAULT_SENSITIVITY
            } as ISnappingRouteOptions;
        }
        let minDistance = Infinity;
        let response = {
            latlng: latlng,
            polyline: null
        } as ISnappingRouteResponse;

        for (let polyline of options.polylines) {
            let latlngs = polyline.getLatLngs() as L.LatLng[];
            if (latlngs.length <= 1) {
                continue;
            }

            let snapPoint = this.mapService.map.latLngToLayerPoint(latlng);
            let prevPoint = this.mapService.map.latLngToLayerPoint(latlngs[0]);
            let startDistance = snapPoint.distanceTo(prevPoint);

            if (startDistance <= options.sensitivity && startDistance < minDistance) {
                minDistance = startDistance;
                response.latlng = latlngs[0];
                response.polyline = polyline;
                response.beforeIndex = 0;
            }

            for (let latlngIndex = 1; latlngIndex < latlngs.length; latlngIndex++) {
                let currentPoint = this.mapService.map.latLngToLayerPoint(latlngs[latlngIndex]);

                let currentDistance = L.LineUtil.pointToSegmentDistance(snapPoint, prevPoint, currentPoint);
                if (currentDistance < minDistance && currentDistance <= options.sensitivity) {
                    minDistance = currentDistance;
                    let closestPointSegment = L.LineUtil.closestPointOnSegment(snapPoint, prevPoint, currentPoint);
                    response.latlng = this.mapService.map.layerPointToLatLng(closestPointSegment);
                    response.polyline = polyline;
                    response.beforeIndex = latlngIndex - 1;
                }
                prevPoint = currentPoint;
            }
        }
        return response;
    }

    /**
     * This method will snap to the nearest point. markerData will be null in case there were no points near by.
     */
    public snapToPoint = (latlng: L.LatLng, options?: ISnappingPointOptions): ISnappingPointResponse => {
        let defaultOptions = {
            points: this.pointsSnappings,
            sensitivity: 2 * SnappingService.DEFAULT_SENSITIVITY
        } as ISnappingPointOptions;
        options = Object.assign(defaultOptions, options);

        let response = {
            latlng: latlng,
            markerData: null,
            id: null
        } as ISnappingPointResponse;
        let pointOnScreen = this.mapService.map.latLngToLayerPoint(latlng);
        for (let markerData of options.points) {
            let markerPointOnScreen = this.mapService.map.latLngToLayerPoint(markerData.latlng);
            if (markerPointOnScreen.distanceTo(pointOnScreen) < options.sensitivity && response.markerData == null) {
                response.latlng = markerData.latlng;
                response.markerData = markerData;
            } else if (response.markerData != null
                && response.markerData.latlng.distanceTo(latlng) > markerData.latlng.distanceTo(latlng)) {
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

    public async getClosestPoint(location: L.LatLng): Promise<Common.MarkerData> {
        let params = new HttpParams()
            .set("location", location.lat + "," + location.lng);
        let feature = await this.httpClient.get(Urls.osmClosest, { params: params }).toPromise() as GeoJSON.Feature<GeoJSON.GeometryObject>;
        if (feature == null) {
            return null;
        }
        let dataContainer = this.geoJsonParser.toDataContainer({
                features: [feature],
                type: "FeatureCollection"
            },
            this.resources.getCurrentLanguageCodeSimplified());
        let markerData = dataContainer.routes[0].markers[0];
        console.log(feature);
        return markerData;
    }
}