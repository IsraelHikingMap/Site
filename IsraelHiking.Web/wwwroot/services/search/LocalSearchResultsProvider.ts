namespace IsraelHiking.Services.Search {

    export interface ISearchResults {
        name: string;
        address: string;
        icon: string;
        searchTerm: string;
        latlng: L.LatLng;
        latlngsArray: L.LatLng[][];
        bounds: L.LatLngBounds;
        displayName: string;
        feature: GeoJSON.Feature<GeoJSON.GeometryObject>;
    }

    export class LocalSearchResultsProvider {

        private $http: angular.IHttpService;
        private $q: angular.IQService;

        constructor($http: angular.IHttpService,
            $q: angular.IQService) {
            this.$http = $http;
            this.$q = $q;
        }

        public getResults = (searchTerm: string, isHebrew: boolean): angular.IPromise<ISearchResults[]> => {
            var deferred = this.$q.defer();
            var params = isHebrew ? {} : { language: "en" };
            this.$http.get(Common.Urls.search + searchTerm, {
                params: params
            }).then((response: { data: GeoJSON.FeatureCollection<GeoJSON.GeometryObject> }) => {
                let results = [] as ISearchResults[];
                for (let feature of response.data.features) {
                    let properties = feature.properties as any;
                    let singleResult = {
                        name: this.getName(feature, isHebrew),
                        latlngsArray: [],
                        icon: properties.icon,
                        address: isHebrew ? properties.address : feature.properties["address:en"],
                        feature: feature
                } as ISearchResults;
                    try {
                        switch (feature.geometry.type) {
                            case Strings.GeoJson.point:
                                var point = feature.geometry as GeoJSON.Point;
                                singleResult.latlng = Services.Parsers.GeoJsonParser.createLatlng(point.coordinates) as L.LatLng;
                                break;
                            case Strings.GeoJson.lineString:
                                var lineString = feature.geometry as GeoJSON.LineString;
                                singleResult.latlng = Services.Parsers.GeoJsonParser.createLatlng(lineString.coordinates[0]) as L.LatLng;
                                singleResult.latlngsArray.push(Services.Parsers.GeoJsonParser.createLatlngArray(lineString.coordinates));
                                break;
                            case Strings.GeoJson.multiLineString:
                                var multiLineString = feature.geometry as GeoJSON.MultiLineString;
                                singleResult.latlng = Services.Parsers.GeoJsonParser.createLatlng(multiLineString.coordinates[0][0]) as L.LatLng;
                                for (let currentCoordinatesArray of multiLineString.coordinates) {
                                    singleResult.latlngsArray.push(Services.Parsers.GeoJsonParser.createLatlngArray(currentCoordinatesArray));
                                }
                                break;
                            case Strings.GeoJson.polygon:
                                var polygone = feature.geometry as GeoJSON.Polygon;
                                singleResult.latlng = Services.Parsers.GeoJsonParser.createLatlng(polygone.coordinates[0][0]) as L.LatLng;
                                for (let currentCoordinatesArray of polygone.coordinates) {
                                    singleResult.latlngsArray.push(Services.Parsers.GeoJsonParser.createLatlngArray(currentCoordinatesArray));
                                }
                                break;
                            case Strings.GeoJson.multiPolygon:
                                var multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                                singleResult.latlng = Services.Parsers.GeoJsonParser.createLatlng(multiPolygone.coordinates[0][0][0]) as L.LatLng;
                                for (let currentPolygoneCoordinates of multiPolygone.coordinates) {
                                    for (let currentCoordinatesArray of currentPolygoneCoordinates) {
                                        singleResult.latlngsArray.push(Services.Parsers.GeoJsonParser.createLatlngArray(currentCoordinatesArray));
                                    }
                                }
                        }
                        if (properties.lat && properties.lng) {
                            singleResult.latlng = L.latLng(properties.lat, properties.lng);
                        }
                        let geo = L.geoJSON(feature);
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
            }, (err) => {
                deferred.reject(err);
            });

            return deferred.promise;
        }

        private getName(feature: GeoJSON.Feature<GeoJSON.GeometryObject>, isHebrew: boolean): string {
            let properties = feature.properties as any;
            let name = isHebrew
                ? properties.name || feature.properties["name:he"]
                : feature.properties["name:en"] || properties.name;
            if (name) {
                return name;
            }
            let resultsArray = _.pick(feature.properties, (value, key) => key.contains("name"));
            return resultsArray[0];
        }
    }
}