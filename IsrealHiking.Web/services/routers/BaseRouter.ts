module IsraelHiking.Services.Routers {
    export class BaseRouter implements IRouter {
        private $http: angular.IHttpService;
        private $q: angular.IQService;
        private toastr: Toastr;
        private geojsonParser: Parsers.BaseParser;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            toastr: Toastr,
            geojsonParser: Parsers.IParser) {
            this.$http = $http;
            this.$q = $q;
            this.toastr = toastr;
            this.geojsonParser = <Parsers.BaseParser>geojsonParser;
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng): angular.IPromise<Common.RouteSegmentData[]> {
            var address = Common.Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng + "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + this.getProfile();
            var deferred = this.$q.defer();
            var noneRouter = new NoneRouter(this.$q);
            this.$http.get(address, <angular.IRequestShortcutConfig> { timeout: 4500 })
                .success((geojson: GeoJSON.FeatureCollection, status) => {
                    var failed = false;
                    try {
                        var data = this.geojsonParser.toDataContainer(geojson);
                    } catch (err) {
                        failed = true;
                    }
                    if (failed || data.routes.length == 0 || data.routes[0].segments.length < 2) {
                        toastr.error("Failed routing from " + latlngStart + " to " + latlngEnd, "Routing");
                        noneRouter.getRoute(latlngStart, latlngEnd).then((noneRouterData) => {
                            deferred.resolve(noneRouterData);
                        });
                    } else {
                        deferred.resolve(data.routes[0].segments);
                    }
                }).error((err) => {
                    this.toastr.error("Failed routing from " + latlngStart + " to " + latlngEnd, "Routing");
                    noneRouter.getRoute(latlngStart, latlngEnd).then((data) => {
                        deferred.resolve(data);
                    });

                });
            return deferred.promise;
        }
        //should be implemented in derrived
        protected getProfile(): string {
            return "h";
        }
    }
}  