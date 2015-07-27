module IsraelHiking.Common {
    export class routingType {
        public static hike = "h"; 
        public static bike = "b";
        public static fourByFour = "f";
        public static none = "n";
    }

    export interface MarkerData {
        latlng: L.LatLng;
        title: string;
    }

    export interface RouteSegmentData {
        routePoint: L.LatLng;
        latlngs: L.LatLng[];
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
}