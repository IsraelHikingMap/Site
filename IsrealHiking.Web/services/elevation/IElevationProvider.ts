module IsraelHiking.Services.Elevation {
    export interface IElevationProvider {
        updateHeights(latlngzs: Common.LatLngZ[]): angular.IHttpPromise<{}>
    }
}