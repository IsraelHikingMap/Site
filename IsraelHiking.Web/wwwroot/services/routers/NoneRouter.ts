namespace IsraelHiking.Services.Routers {
    export class NoneRouter {
        $q: angular.IQService;
        constructor($q: angular.IQService) {
            this.$q = $q;
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]> {
            var deferred = this.$q.defer();
            var emptyReturn = [] as Common.RouteSegmentData[];
            var latlngStart = latlngStart;
            latlngStart.alt = 0;
            var latlngEnd = latlngEnd;
            latlngEnd.alt = 0;
            emptyReturn.push({
                routePoint: latlngEnd,
                latlngs: [latlngStart, latlngEnd],
                routingType: "None"
            } as Common.RouteSegmentData);
            deferred.resolve(emptyReturn);
            return deferred.promise;
        }
    }

} 