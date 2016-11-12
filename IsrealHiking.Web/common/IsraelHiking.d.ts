declare namespace IsraelHiking.Common {
    type RoutingType = "Hike" | "Bike" | "4WD" | "None";

    export interface SiteUrl {
        Id: string;
        Title: string;
        JsonData: string;
        ModifyKey: string;
        OsmUserId: string;
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
    }

    export interface RouteSegmentData {
        routePoint: L.LatLng;
        latlngzs: LatLngZ[];
        routingType: RoutingType;
    }

    export interface RouteData {
        name: string;
        segments: RouteSegmentData[];
    }

    export interface DataContainer {
        routes: RouteData[];
        markers: MarkerData[];
        baseLayer: LayerData;
        overlays: LayerData[];
        northEast: L.LatLng;
        southWest: L.LatLng;
    }

    export interface LatLngZ extends L.LatLng {
        z: number;
    }
}