module IsraelHiking.Services.Routers {
    export class NoneRouter implements IRouter {
        $q: angular.IQService;
        constructor($q: angular.IQService) {
            this.$q = $q;
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]> {
            var deferred = this.$q.defer();
            var emptyReturn = <Common.RouteSegmentData[]>[];
            var latlngMiddle = L.latLng((latlngStart.lat + latlngEnd.lat) / 2,(latlngStart.lng + latlngEnd.lng) / 2);
            emptyReturn.push(<Common.RouteSegmentData> {
                routePoint: latlngEnd,
                latlngs: [latlngStart, latlngMiddle, latlngEnd],
                routingType: Common.routingType.none,
            });
            deferred.resolve(emptyReturn);
            return deferred.promise;
        }
    }

} 