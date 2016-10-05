namespace IsraelHiking.Services.Search {
    export class LocalSearchResultsProvider extends BaseSearchResultsProvider {

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            super($http, $q);
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => {
            var deferred = this.$q.defer();
            var params = isHebrew ? {} : { language: "en" };
            this.$http.get(Common.Urls.search + searchTerm, {
                params: params
            }).success((response: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>) => {
                let results = [] as ISearchResults[];
                for (let feature of response.features) {
                    let singleResult = {
                        name: this.getName(feature, isHebrew),
                        latlngsArray: [],
                        icon: feature.properties.icon,
                        address: isHebrew ? feature.properties.address : feature.properties["address:en"],
                        feature: feature
                } as ISearchResults;
                    try {
                        switch (feature.geometry.type) {
                            case Strings.GeoJson.point:
                                var point = feature.geometry as GeoJSON.Point;
                                singleResult.latlng = Services.Parsers.BaseParser.createLatlng(point.coordinates) as L.LatLng;
                                break;
                            case Strings.GeoJson.lineString:
                                var lineString = feature.geometry as GeoJSON.LineString;
                                singleResult.latlng = Services.Parsers.BaseParser.createLatlng(lineString.coordinates[0]) as L.LatLng;
                                singleResult.latlngsArray.push(Services.Parsers.BaseParser.createLatlngArray(lineString.coordinates));
                                break;
                            case Strings.GeoJson.multiLineString:
                                var multiLineString = feature.geometry as GeoJSON.MultiLineString;
                                singleResult.latlng = Services.Parsers.BaseParser.createLatlng(multiLineString.coordinates[0][0]) as L.LatLng;
                                for (let currentCoordinatesArray of multiLineString.coordinates) {
                                    singleResult.latlngsArray.push(Services.Parsers.BaseParser.createLatlngArray(currentCoordinatesArray));
                                }
                                break;
                            case Strings.GeoJson.polygone:
                                var polygone = feature.geometry as GeoJSON.Polygon;
                                singleResult.latlng = Services.Parsers.BaseParser.createLatlng(polygone.coordinates[0][0]) as L.LatLng;
                                for (let currentCoordinatesArray of polygone.coordinates) {
                                    singleResult.latlngsArray.push(Services.Parsers.BaseParser.createLatlngArray(currentCoordinatesArray));
                                }
                                break;
                            case Strings.GeoJson.multiPolygon:
                                var multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                                singleResult.latlng = Services.Parsers.BaseParser.createLatlng(multiPolygone.coordinates[0][0][0]) as L.LatLng;
                                for (let currentPolygoneCoordinates of multiPolygone.coordinates) {
                                    for (let currentCoordinatesArray of currentPolygoneCoordinates) {
                                        singleResult.latlngsArray.push(Services.Parsers.BaseParser.createLatlngArray(currentCoordinatesArray));
                                    }
                                }
                        }
                        if (feature.properties.lat && feature.properties.lng) {
                            singleResult.latlng = L.latLng(feature.properties.lat, feature.properties.lng);
                        }
                        let geo = L.geoJson(feature);
                        singleResult.bounds = geo.getBounds();
                        singleResult.displayName = singleResult.name + (singleResult.address ? `, ${singleResult.address}` : "");
                        results.push(singleResult);
                    }
                    catch (error) {
                        console.error(error);
                        console.log(feature);
                    }
                }
                deferred.resolve(results);
            }).error((err) => {
                deferred.reject(err);
            });

            return deferred.promise;
        }

        private getName(feature: GeoJSON.Feature<GeoJSON.GeometryObject>, isHebrew: boolean): string {
            let name = isHebrew
                ? feature.properties.name || feature.properties["name:he"]
                : feature.properties["name:en"] || feature.properties.name;
            if (name) {
                return name;
            }
            let resultsArray = _.pick(feature.properties, (value, key) => key.contains("name"));
            return resultsArray[0];
        }
    }
}