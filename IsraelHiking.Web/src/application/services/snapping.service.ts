import { inject, Service } from "@angular/core";
import type { Immutable } from "immer";

import { SpatialHelper } from "./spatial.helper";
import { MapService } from "./map.service";
import type { LatLngAltTime, MarkerData } from "../models";

export type SnappingPointResponse = {
    latlng: LatLngAltTime;
    markerData: Immutable<MarkerData>;
};

@Service()
export class SnappingService {
    private static readonly SENSITIVITY = 30;

    private readonly mapService = inject(MapService);

    /**
     * This method will snap to the nearest point. markerData will be null in case there were no points near by.
     */
    public snapToPoint(latlng: LatLngAltTime, points: Immutable<MarkerData[]>): SnappingPointResponse {
        const response = {
            latlng,
            markerData: null,
            id: null
        } as SnappingPointResponse;
        const pointOnScreen = this.mapService.project(latlng);
        for (const markerData of points) {
            const markerPointOnScreen = this.mapService.project(markerData.latlng);
            if (SpatialHelper.getDistanceForCoordinates([markerPointOnScreen.x, markerPointOnScreen.y],
                [pointOnScreen.x, pointOnScreen.y]) < SnappingService.SENSITIVITY &&
                response.markerData == null) {
                response.latlng = markerData.latlng;
                response.markerData = markerData;
            } else if (response.markerData != null
                && SpatialHelper.getDistanceInMeters(response.markerData.latlng, latlng) >
                SpatialHelper.getDistanceInMeters(markerData.latlng, latlng)) {
                response.latlng = markerData.latlng;
                response.markerData = markerData;
            }
        }
        return response;
    }
}
