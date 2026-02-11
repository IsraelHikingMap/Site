import { LatLngAltTime, MarkerDataWithoutId } from ".";

export type RecordedRoute = {
    markers: MarkerDataWithoutId[];
    latlngs: LatLngAltTime[];
};
