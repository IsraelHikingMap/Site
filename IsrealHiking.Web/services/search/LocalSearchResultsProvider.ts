module IsraelHiking.Services.Search {
    export class LocalSearchResultsProvider extends BaseSearchResultsProvider {

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            super($http, $q);
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => {
            var deferred = this.$q.defer();
            var parser = new Parsers.GeoJsonParser();
            var params = isHebrew ? {} : { language: "en" };
            this.$http.get(Common.Urls.search + searchTerm, {
                params: params
            }).success((response: GeoJSON.FeatureCollection) => {
                var data = parser.parse(JSON.stringify(response));
                var results = [] as ISearchResults[];
                for (let marker of data.markers) {
                    results.push({
                        searchTerm: searchTerm,
                        name: marker.title,
                        latlng: marker.latlng,
                        latlngsArray: []
                    } as ISearchResults);
                }
                for (let route of data.routes) {
                    if (!route.name || route.segments.length === 2) {
                        // getting only relations with name
                        continue;
                    }
                    let searchResult = {
                        name: route.name,
                        searchTerm: searchTerm,
                        icon: "/content/images/OSM-relation.png",
                        latlngsArray: []
                    } as ISearchResults;
                    for (let segment of route.segments) {
                        if (segment.latlngzs.length > 0) {
                            searchResult.latlngsArray.push(segment.latlngzs);
                        }
                    }
                    if (searchResult.latlngsArray.length > 0) {
                        searchResult.latlng = searchResult.latlngsArray[0][0];
                        results.push(searchResult);
                    }
                }
                deferred.resolve(results);
            }).error((err) => {
                deferred.reject(err);
            });

            return deferred.promise;
        }
    }
}