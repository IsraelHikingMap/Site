export type RoutingType = "Hike" | "Bike" | "4WD" | "None";

export interface SiteUrl {
    id: string;
    title: string;
    description: string;
    jsonData: string;
    osmUserId: string;
    viewsCount: number;
}

export interface LayerData {
    key: string;
    address: string;
    minZoom: number;
    maxZoom: number;
}

export interface MarkerData {
    latlng: L.LatLng;
    title: string;
    type: string;
    id?: string;
}

export interface RouteSegmentData {
    routePoint: L.LatLng;
    latlngs: L.LatLng[];
    routingType: RoutingType;
}

export interface RouteData {
    name: string;
    description: string;
    color?: string;
    opacity?: number;
    weight?: number;
    markers: MarkerData[];
    segments: RouteSegmentData[];
}

export interface DataContainer {
    routes: RouteData[];
    baseLayer: LayerData;
    overlays: LayerData[];
    northEast: L.LatLng;
    southWest: L.LatLng;
}

export interface IMarkerWithTitle extends L.Marker {
    title: string;
    identifier: string;
}