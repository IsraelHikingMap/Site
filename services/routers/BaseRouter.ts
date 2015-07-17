module IsraelHiking.Services.Routers {
    export class BaseRouter implements IRouter {
        $http: angular.IHttpService;
        $q: angular.IQService;
        geojsonParser: Parsers.BaseParser;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            geojsonParser: Parsers.IParser) {
            this.$http = $http;
            this.$q = $q;
            this.geojsonParser = <Parsers.BaseParser>geojsonParser;
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]> {
            var route = "http://h2096617.stratoserver.net:443/brouter?nogos=&alternativeidx=0&format=geojson";
            var params = "&profile=" + this.getProfile() + "&lonlats=" + latlngStart.lng + "," + latlngStart.lat + "|" + latlngEnd.lng + "," + latlngEnd.lat;
            var deferred = this.$q.defer();
            var noneRouter = new NoneRouter(this.$q);
            this.$http.get(route + params).success((geojson: GeoJSON.FeatureCollection, status) => {
                var data = this.geojsonParser.toDataContainer(geojson);
                if (data.routeData.segments.length < 2) {
                    noneRouter.getRoute(latlngStart, latlngEnd).then((noneRouterData) => {
                        deferred.resolve(noneRouterData);
                    });
                } else {
                    deferred.resolve(data.routeData.segments);
                }
            }).error(() => {
                noneRouter.getRoute(latlngStart, latlngEnd).then((data) => {
                    deferred.resolve(data);
                });

            });
            return deferred.promise;
        }
        //should be implemented in derrived
        protected getProfile(): string {
            return "trekking";
        }
    }
}  