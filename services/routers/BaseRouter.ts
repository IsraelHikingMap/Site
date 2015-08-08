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
            this.$http.get(route + params, <angular.IRequestShortcutConfig> { timeout: 4500 }).success((geojson: GeoJSON.FeatureCollection, status) => {
                var failed = false;
                try {
                    var data = this.geojsonParser.toDataContainer(geojson);
                } catch (err) {
                    failed = true;
                }
                if (failed || data.routes.length == 0 || data.routes[0].segments.length < 2) {
                    // HM TODO: toast?
                    console.error("Failed routing from " + latlngStart + " to " + latlngEnd);
                    noneRouter.getRoute(latlngStart, latlngEnd).then((noneRouterData) => {
                        deferred.resolve(noneRouterData);
                    });
                } else {
                    deferred.resolve(data.routes[0].segments);
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