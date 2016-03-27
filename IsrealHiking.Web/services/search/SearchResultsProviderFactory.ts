module IsraelHiking.Services.Search {
    export class SearchProviderType {
        public static nominatim = "Nominatim";
        public static overpass = "Overpass";
        public static local = "local";
    }

    export class SearchResultsProviderFactory {
        private $http: angular.IHttpService;
        private $q: angular.IQService;

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            this.$http = $http;
            this.$q = $q;
        }

        public create = (searchProviderType: string): ISearchResultsProvider => {
            switch (searchProviderType) {
                case SearchProviderType.nominatim:
                    return new NominatimSearchResultsProvider(this.$http, this.$q);
                case SearchProviderType.overpass:
                    return new OverpassSearchResultsProvider(this.$http, this.$q);
                case SearchProviderType.local:
                    return new LocalSearchResultsProvider(this.$http, this.$q);
                default:
                    throw new Error("Invalid search provider type.");
            }
        }
    }

}