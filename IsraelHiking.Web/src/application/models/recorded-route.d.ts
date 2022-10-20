import { LatLngAltTime, MarkerData } from "./models";

export type RecordedRoute = {
    markers: MarkerData[];
    latlngs: LatLngAltTime[];
};
