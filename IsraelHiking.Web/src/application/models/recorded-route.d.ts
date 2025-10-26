import { type LatLngAltTime, type MarkerData } from ".";

export type RecordedRoute = {
    markers: MarkerData[];
    latlngs: LatLngAltTime[];
};
