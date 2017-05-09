namespace IsraelHiking.Services.Elevation {
    export interface IElevationProvider {
        updateHeights(latlngs: L.LatLng[]): angular.IHttpPromise<{}>
    }
}