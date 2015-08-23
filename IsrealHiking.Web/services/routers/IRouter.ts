module IsraelHiking.Services.Routers {
    export interface IRouter {
        getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]>
    }
} 