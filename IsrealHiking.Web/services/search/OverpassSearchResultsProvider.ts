module IsraelHiking.Services.Search {

    export class OverpassSearchResultsProvider extends BaseSearchResultsProvider {

        private static LIMIT = 5;

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            super($http, $q);
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => {
            var deferered = this.$q.defer();
            var nameKey = isHebrew ? "name" : "name:en";
            var parser = new Parsers.OsmParser();
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
                var data = parser.parse(osm);
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
                deferered.resolve(results);
            }).error((err) => {
                deferered.reject(err);
            });

            return deferered.promise;
        }
    }
}