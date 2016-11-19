namespace IsraelHiking.Services.Routers {
    export class RouterService {
        private $http: angular.IHttpService;
        private $q: angular.IQService;
        private resourcesService: ResourcesService;
        private toastr: Toastr;
        private geojsonParser: Parsers.GeoJsonParser;
        private noneRouter: NoneRouter;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            resourcesService: ResourcesService,
            toastr: Toastr,
            geoJsonParser: Parsers.GeoJsonParser) {
            this.$http = $http;
            this.$q = $q;
            this.resourcesService = resourcesService;
            this.toastr = toastr;
            this.geojsonParser = geoJsonParser;
            this.noneRouter = new NoneRouter(this.$q);
        }

        public getRoute(latlngStart: L.LatLng, latlngEnd: L.LatLng, routinType: Common.RoutingType): angular.IPromise<Common.RouteSegmentData[]> {
            var address = Common.Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng + "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
            var deferred = this.$q.defer();
            this.$http.get(address, { timeout: 4500 } as angular.IRequestShortcutConfig)
                .success((geojson: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>) => {
                    var failed = false;
                    let data = null;
                    try {
                        data = this.geojsonParser.toDataContainer(geojson);
                    } catch (err) {
                        failed = true;
                    }
                    if (failed || !data || data.routes.length === 0 || data.routes[0].segments.length < 2) {
                        this.toastr.error(this.resourcesService.routingFailed + ` ${latlngStart} => ${latlngEnd}`);
                        this.noneRouter.getRoute(latlngStart, latlngEnd).then((noneRouterData) => {
                            deferred.resolve(noneRouterData);
                        });
                    } else {
                        deferred.resolve(data.routes[0].segments);
                    }
                }).error(() => {
                    this.toastr.error(this.resourcesService.routingFailed + ` ${latlngStart} => ${latlngEnd}`);
                    this.noneRouter.getRoute(latlngStart, latlngEnd).then((data) => {
                        deferred.resolve(data);
                    });

                });
            return deferred.promise;
        }
    }
}  