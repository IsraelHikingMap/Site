import type { RouteData, LayerData, LatLngAlt  } from "./models";

export type DataContainer = {
    routes: RouteData[];
    baseLayer: LayerData;
    overlays: LayerData[];
    northEast: LatLngAlt;
    southWest: LatLngAlt;
}
