declare namespace IsraelHiking.Common {
    type RoutingType = "Hike" | "Bike" | "4WD" | "None";

    export interface SiteUrl {
        id: string;
        title: string;
        description: string;
        jsonData: string;
        osmUserId: string;
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
    }

    export interface RouteSegmentData {
        routePoint: L.LatLng;
        latlngzs: LatLngZ[];
        routingType: RoutingType;
    }

    export interface RouteData {
        name: string;
        color?: string;
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

    export interface LatLngZ extends L.LatLng {
        z: number;
    }
}