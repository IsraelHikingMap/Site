module IsraelHiking.Services.Routers {

    export class RouterFactory {
        $http: angular.IHttpService;
        $q: angular.IQService;
        geojsonParser: Parsers.IParser;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            parserFactory: Parsers.ParserFactory) {
            this.$http = $http;
            this.$q = $q;
            this.geojsonParser = parserFactory.Create("geojson");
        }

        public create(routingType: Common.RoutingType): IRouter {
            switch (routingType) {
                case Common.RoutingType.hike:
                    return new HikeRouter(this.$http, this.$q, this.geojsonParser);
                case Common.RoutingType.bike:
                    return new BikeRouter(this.$http, this.$q, this.geojsonParser);
                case Common.RoutingType.fourWheelDrive:
                    return new FourWheelDriveRouter(this.$http, this.$q, this.geojsonParser);
                default:
                    return new NoneRouter(this.$q);
            }
        }
    }
}