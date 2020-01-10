import { Injectable } from "@angular/core";
import { Map } from "mapbox-gl";

import { SpatialService } from "./spatial.service";
import { LatLngAlt, MarkerData } from "../models/models";

export interface ISnappingPointResponse {
    latlng: LatLngAlt;
    markerData: MarkerData;
}

@Injectable()
export class SnappingService {
    private static readonly SENSITIVITY = 30;

    private map: Map;

    public setMap(map: Map) {
        this.map = map;
    }

    /**
     * This method will snap to the nearest point. markerData will be null in case there were no points near by.
     */
    public snapToPoint = (latlng: LatLngAlt, points: MarkerData[]): ISnappingPointResponse => {
        let response = {
            latlng,
            markerData: null,
            id: null
        } as ISnappingPointResponse;
        let pointOnScreen = this.map.project(latlng);
        for (let markerData of points) {
            let markerPointOnScreen = this.map.project(markerData.latlng);
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
