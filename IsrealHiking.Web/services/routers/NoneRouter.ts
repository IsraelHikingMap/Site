module IsraelHiking.Services.Routers {
    export class NoneRouter {
        $q: angular.IQService;
        constructor($q: angular.IQService) {
            this.$q = $q;
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]> {
            var deferred = this.$q.defer();
            var emptyReturn = [] as Common.RouteSegmentData[];
            var latlngzStart = latlngStart as Common.LatLngZ;
            latlngzStart.z = 0;
            var latlngzEnd = latlngEnd as Common.LatLngZ;
            latlngzEnd.z = 0;
            emptyReturn.push({
                routePoint: { latlng: latlngEnd, title: "" } as Common.MarkerData,
                latlngzs: [latlngzStart, latlngzEnd],
                routingType: Common.RoutingType.none,
            } as Common.RouteSegmentData);
            deferred.resolve(emptyReturn);
            return deferred.promise;
        }
    }

} 