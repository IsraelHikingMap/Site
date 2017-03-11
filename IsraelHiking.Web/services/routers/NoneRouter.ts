﻿namespace IsraelHiking.Services.Routers {
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
                routePoint: latlngEnd,
                latlngzs: [latlngzStart, latlngzEnd],
                routingType: "None"
            } as Common.RouteSegmentData);
            deferred.resolve(emptyReturn);
            return deferred.promise;
        }
    }

} 