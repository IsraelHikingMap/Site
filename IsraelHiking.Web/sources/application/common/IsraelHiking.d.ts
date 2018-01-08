export type RoutingType = "Hike" | "Bike" | "4WD" | "None";

export interface ShareUrl {
    id: string;
    title: string;
    description: string;
    osmUserId: string;
    viewsCount: number;

    dataContainer: DataContainer;
}

export interface LayerData {
    key: string;
    address: string;
    minZoom: number;
    maxZoom: number;
    opacity: number;
}

export interface LinkData {
    url: string;
    text: string;
    mimeType: string;
}

export interface MarkerData {
    latlng: L.LatLng;
    title: string;
    description: string;
    type: string;
    id?: string;
    urls: LinkData[];
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