import type { MarkerData } from "..";

export type PointsOfInterestState = {
    selectedPointOfInterest: GeoJSON.Feature;
    uploadMarkerData: MarkerData;
};
