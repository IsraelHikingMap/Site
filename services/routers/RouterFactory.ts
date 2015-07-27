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

        public create(routingType: Common.routingType): IRouter {
            switch (routingType) {
                case Common.routingType.hike:
                    return new HikeRouter(this.$http, this.$q, this.geojsonParser);
                case Common.routingType.bike:
                    return new BikeRouter(this.$http, this.$q, this.geojsonParser);
                case Common.routingType.fourWheelDrive:
                    return new FourWheelDriveRouter(this.$http, this.$q, this.geojsonParser);
                default:
                    return new NoneRouter(this.$q);
            }
        }
    }
}