namespace IsraelHiking.Services.Search {
    export class SearchProviderType {
        public static nominatim = "Nominatim";
        public static overpass = "Overpass";
        public static local = "local";
    }

    export class SearchResultsProviderFactory {
        private $http: angular.IHttpService;
        private $q: angular.IQService;
        private parserFactory: Parsers.ParserFactory;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            parserFactory: Parsers.ParserFactory) {
            this.$http = $http;
            this.$q = $q;
            this.parserFactory = parserFactory;
        }

        public create = (searchProviderType: string): ISearchResultsProvider => {
            switch (searchProviderType) {
                case SearchProviderType.nominatim:
                    return new NominatimSearchResultsProvider(this.$http, this.$q);
                case SearchProviderType.overpass:
                    return new OverpassSearchResultsProvider(this.$http, this.$q, this.parserFactory);
                case SearchProviderType.local:
                    return new LocalSearchResultsProvider(this.$http, this.$q);
                default:
                    throw new Error("Invalid search provider type.");
            }
        }
    }

}