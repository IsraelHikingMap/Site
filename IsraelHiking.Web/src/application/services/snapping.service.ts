import { Injectable } from "@angular/core";

import { SpatialService } from "./spatial.service";
import { LatLngAlt, MarkerData } from "../models/models";
import { MapService } from "./map.service";

export interface ISnappingPointResponse {
    latlng: LatLngAlt;
    markerData: MarkerData;
}

@Injectable()
export class SnappingService {
    private static readonly SENSITIVITY = 30;

    constructor(private readonly mapService: MapService) { }

    /**
     * This method will snap to the nearest point. markerData will be null in case there were no points near by.
     */
    public snapToPoint = (latlng: LatLngAlt, points: MarkerData[]): ISnappingPointResponse => {
        let response = {
            latlng,
            markerData: null,
            id: null
        } as ISnappingPointResponse;
        let pointOnScreen = this.mapService.map.project(latlng);
        for (let markerData of points) {
            let markerPointOnScreen = this.mapService.map.project(markerData.latlng);
            if (SpatialService.getDistanceForCoordinates([markerPointOnScreen.x, markerPointOnScreen.y],
                [pointOnScreen.x, pointOnScreen.y]) < SnappingService.SENSITIVITY &&
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
}
