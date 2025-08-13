import type { RouteData, LayerData, LatLngAlt  } from ".";

export type DataContainer = {
    routes: RouteData[];
    baseLayer: LayerData;
    overlays: LayerData[];
    northEast: LatLngAlt;
    southWest: LatLngAlt;
};
