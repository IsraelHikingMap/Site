import { RouteData, LayerData, LatLngAlt  } from "./models";

export interface DataContainer {
    routes: RouteData[];
    baseLayer: LayerData;
    overlays: LayerData[];
    northEast: LatLngAlt;
    southWest: LatLngAlt;
}