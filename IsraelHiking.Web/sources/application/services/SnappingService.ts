import { Http } from "@angular/http";
import { Injectable } from "@angular/core";
import { MapService } from "./MapService";
import { ResourcesService } from "./ResourcesService";
import { ToastService } from "./ToastService";
import { Urls } from "../common/Urls";
import * as _ from "lodash";
import "rxjs/add/operator/toPromise";
import { GeoJson, GeoJsonParser } from "./GeoJsonParser";

export interface ISnappingOptions {
    layers: L.LayerGroup;
    sensitivity: number;
}

export interface ISnappingResponse {
    latlng: L.LatLng;
    polyline: L.Polyline;
    beforeIndex: number;
}

interface ISnappingRequestQueueItem {
    boundsString: string;
}

@Injectable()
export class SnappingService {
    public snappings: L.LayerGroup;
    private enabled: boolean;
    private requestsQueue: ISnappingRequestQueueItem[];

    constructor(private http: Http,
        private resourcesService: ResourcesService,
        private mapService: MapService,
        private toastService: ToastService,
    ) {
        this.resourcesService = resourcesService;
        this.snappings = L.layerGroup([]);
        this.mapService.map.addLayer(this.snappings);
        this.enabled = false;
        this.requestsQueue = [];
        this.mapService.map.on("moveend", () => {
            this.generateSnappings();
        });
    }

    private generateSnappings = () => {

        if (this.mapService.map.getZoom() <= 13 || this.enabled === false) {
            this.snappings.clearLayers();
            return;
        }

        var bounds = this.mapService.map.getBounds();
        var boundsString = [bounds.getSouthWest().lat, bounds.getSouthWest().lng, bounds.getNorthEast().lat, bounds.getNorthEast().lng].join(",");
        this.requestsQueue.push({
            boundsString: boundsString
        } as ISnappingRequestQueueItem);

        this.http.get(Urls.osm, {
            params: {
                northEast: bounds.getNorthEast().lat + "," + bounds.getNorthEast().lng,
                southWest: bounds.getSouthWest().lat + "," + bounds.getSouthWest().lng
            }
        }).toPromise().then((response) => {
            let queueItem = _.find(this.requestsQueue, (itemToFind) => itemToFind.boundsString === boundsString);
            if (queueItem == null || this.requestsQueue.indexOf(queueItem) !== this.requestsQueue.length - 1) {
                this.requestsQueue.splice(0, this.requestsQueue.length - 1);
                return;
            }
            this.snappings.clearLayers();
            for (let feature of response.json() as GeoJSON.Feature<GeoJSON.GeometryObject>[]) {
                switch (feature.geometry.type) {
                    case GeoJson.lineString:
                        var lineString = feature.geometry as GeoJSON.LineString;
                        var latlngsArray = GeoJsonParser.createLatlngArray(lineString.coordinates);
                        this.snappings.addLayer(L.polyline(latlngsArray, { opacity: 0 } as L.PolylineOptions));
                        break;
                    case GeoJson.polygon:
                        var polygon = feature.geometry as GeoJSON.Polygon;
                        var polygonLatlngsArray = GeoJsonParser.createLatlngArray(polygon.coordinates[0]);
                        this.snappings.addLayer(L.polyline(polygonLatlngsArray, { opacity: 0 } as L.PolylineOptions));
                }
            }
            this.requestsQueue.splice(0);
        }, () => {
            this.toastService.warning(this.resourcesService.unableToGetDataForSnapping);
            this.snappings.clearLayers();
            
        });
    }

    public snapTo = (latlng: L.LatLng, options?: ISnappingOptions): ISnappingResponse => {
        if (!options) {
            options = <ISnappingOptions>{
                layers: this.snappings,
                sensitivity: 10
            };
        }
        var minDistance = Infinity;
        var response = {
            latlng: latlng,
            polyline: null
        } as ISnappingResponse;

        options.layers.eachLayer((polyline) => {
            if (!(polyline instanceof L.Polyline)) {
                return;
            }
            var latlngs = polyline.getLatLngs();
            if (latlngs.length <= 1) {
                return;
            }

            var snapPoint = this.mapService.map.latLngToLayerPoint(latlng);
            var prevPoint = this.mapService.map.latLngToLayerPoint(latlngs[0]);
            var startDistance = snapPoint.distanceTo(prevPoint);

            if (startDistance <= options.sensitivity && startDistance < minDistance) {
                minDistance = startDistance;
                response.latlng = latlngs[0];
                response.polyline = polyline;
                response.beforeIndex = 0;
            }

            for (let latlngIndex = 1; latlngIndex < latlngs.length; latlngIndex++) {
                var currentPoint = this.mapService.map.latLngToLayerPoint(latlngs[latlngIndex]);

                var currentDistance = L.LineUtil.pointToSegmentDistance(snapPoint, prevPoint, currentPoint);
                if (currentDistance < minDistance && currentDistance <= options.sensitivity) {
                    minDistance = currentDistance;
                    response.latlng = this.mapService.map.layerPointToLatLng(L.LineUtil.closestPointOnSegment(snapPoint, prevPoint, currentPoint));
                    response.polyline = polyline;
                    response.beforeIndex = latlngIndex - 1;
                }
                prevPoint = currentPoint;
            }
        });

        return response;
    }

    public enable = (enable: boolean) => {
        this.enabled = enable;
        if (this.enabled) {
            this.generateSnappings();
        }
    }

    public isEnabled = (): boolean => {
        return this.enabled;
    }
}