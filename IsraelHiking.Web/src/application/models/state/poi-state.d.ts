import type { MarkerData } from "../models";

export type PointsOfInterestState = {
    selectedPointOfInterest: GeoJSON.Feature;
    uploadMarkerData: MarkerData;
};
