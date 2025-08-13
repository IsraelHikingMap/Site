import { inject, Injectable } from "@angular/core";
import type { Immutable } from "immer";

import { SpatialService } from "./spatial.service";
import { MapService } from "./map.service";
import type { LatLngAlt, MarkerData } from "../models";

export type SnappingPointResponse = {
    latlng: LatLngAlt;
    markerData: Immutable<MarkerData>;
};

@Injectable()
export class SnappingService {
    private static readonly SENSITIVITY = 30;

    private readonly mapService = inject(MapService);

    /**
     * This method will snap to the nearest point. markerData will be null in case there were no points near by.
     */
    public snapToPoint(latlng: LatLngAlt, points: Immutable<MarkerData[]>): SnappingPointResponse {
        const response = {
            latlng,
            markerData: null,
            id: null
        } as SnappingPointResponse;
        const pointOnScreen = this.mapService.map.project(latlng);
        for (const markerData of points) {
            const markerPointOnScreen = this.mapService.map.project(markerData.latlng);
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
