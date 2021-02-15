import { MarkerData } from "../models";

export interface PointsOfInterestState {
    selectedPointOfInterest: GeoJSON.Feature;
    uploadMarkerData: MarkerData;
    isSidebarOpen: boolean;
}