module IsraelHiking.Services.Routers {

    export class RouterFactory {
        $http: angular.IHttpService;
        $q: angular.IQService;
        toastr: Toastr;
        geojsonParser: Parsers.IParser;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            toastr: Toastr,
            parserFactory: Parsers.ParserFactory) {
            this.$http = $http;
            this.$q = $q;
            this.toastr = toastr;
            this.geojsonParser = parserFactory.Create("geojson");
        }

        public create(routingType: Common.RoutingType): IRouter {
            switch (routingType) {
                case Common.RoutingType.hike:
                    return new HikeRouter(this.$http, this.$q, this.toastr, this.geojsonParser);
                case Common.RoutingType.bike:
                    return new BikeRouter(this.$http, this.$q, this.toastr, this.geojsonParser);
                case Common.RoutingType.fourWheelDrive:
                    return new FourWheelDriveRouter(this.$http, this.$q, this.toastr, this.geojsonParser);
                default:
                    return new NoneRouter(this.$q);
            }
        }
    }
}