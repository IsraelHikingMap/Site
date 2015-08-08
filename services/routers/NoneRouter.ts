module IsraelHiking.Services.Routers {
    export class NoneRouter implements IRouter {
        $q: angular.IQService;
        constructor($q: angular.IQService) {
            this.$q = $q;
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]> {
            var deferred = this.$q.defer();
            var emptyReturn = <Common.RouteSegmentData[]>[];
            var latlngzStart = <Common.LatLngZ>latlngStart;
            latlngzStart.z = 0;
            var latlngzEnd = <Common.LatLngZ>latlngEnd;
            latlngzEnd.z = 0;
            emptyReturn.push(<Common.RouteSegmentData> {
                routePoint: latlngEnd,
                latlngzs: [latlngzStart, latlngzEnd],
                routingType: Common.RoutingType.none,
            });
            deferred.resolve(emptyReturn);
            return deferred.promise;
        }
    }

} 