import { PointOfInterestExtended, MarkerData } from "../models";

export interface PointsOfInterestState {
    selectedPointOfInterest: PointOfInterestExtended;
    uploadMarkerData: MarkerData;
    isSidebarOpen: boolean;
}