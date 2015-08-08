module IsraelHiking.Common {
    export class RoutingType {
        public static hike = "h"; 
        public static bike = "b";
        public static fourWheelDrive = "f";
        public static none = "n";
    }

    export interface MarkerData {
        latlng: L.LatLng;
        title: string;
    }

    export interface RouteSegmentData {
        routePoint: L.LatLng;
        latlngzs: LatLngZ[];
        routingType: string;
    }

    export interface RouteData {
        name: string;
        segments: RouteSegmentData[];
    }

    export interface DataContainer {
        routes: RouteData[];
        markers: MarkerData[];
        bounds: L.LatLngBounds;
    }

    export interface LatLngZ extends L.LatLng {
        z: number;
    }
}