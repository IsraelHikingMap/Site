module IsraelHiking.Services.Search {

    export class OverpassSearchResultsProvider extends BaseSearchResultsProvider {

        private static LIMIT = 5;
        private osmParser: Parsers.IParser;

        constructor($http: angular.IHttpService,
            $q: angular.IQService,
            parserFactory: Parsers.ParserFactory) {
            super($http, $q);
            this.osmParser = parserFactory.create(Parsers.ParserType.osm);
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => {
            var deferred = this.$q.defer();
            var nameKey = isHebrew ? "name" : "name:en";
            var boundsString = [
                BaseSearchResultsProvider.bounds.getSouthWest().lat, BaseSearchResultsProvider.bounds.getSouthWest().lng,
                BaseSearchResultsProvider.bounds.getNorthEast().lat, BaseSearchResultsProvider.bounds.getNorthEast().lng
            ].join(",");
            this.$http.get(Common.Urls.overpass, {
                params: {
                    data: `(rel["${nameKey}"~"${searchTerm}"](${boundsString});>;);out;`
                }
            }).success((osm: string) => {
                if (!isHebrew) {
                    osm = osm.replace(/<tag\s*k=\"name\"\s*v=\".*\"\s*\/>/g, "").replace(/name:en/g, "name");
                }
                var data = this.osmParser.parse(osm);
                var results = [] as ISearchResults[];
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