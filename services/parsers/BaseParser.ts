module IsraelHiking.Services.Parsers {
    export class BaseParser implements IParser {
        private static FEATURE_COLLECTION = "FeatureCollection";
        private static FEATURE = "Feature";
        private static LINE_STRING = "LineString";
        private static POINT = "Point";

        public parse(content: string): Common.DataContainer {
            var geojson = this.parseToGeoJson(content);
            return this.toDataContainer(geojson);
        }
        // should be implemented in derived class
        protected parseToGeoJson(content: string): GeoJSON.FeatureCollection { return null; }
        // should be implemented in derived class
        public toString(data: Common.DataContainer): string { return ""; }

        public toDataContainer(geoJson: GeoJSON.FeatureCollection): Common.DataContainer {

            var data = <Common.DataContainer>{
                markers: <Common.MarkerData[]>[],
                routes: <Common.RouteData[]>[],
            };
            var leaftletGeoJson = L.geoJson(geoJson, <L.GeoJSONOptions>{
                onEachFeature: (feature: GeoJSON.Feature, layer) => {
                    if (feature.type != BaseParser.FEATURE) {
                        return;
                    }
                    if (feature.geometry.type == BaseParser.LINE_STRING) {
                        var lineString = <GeoJSON.LineString>feature.geometry;
                        var latlngzs = <Common.LatLngZ[]>[];
                        for (var coordinate = 0; coordinate < lineString.coordinates.length; coordinate++) {
                            var pointCoordinates = lineString.coordinates[coordinate];
                            latlngzs.push(this.createLatlng(pointCoordinates));
                        }
                        if (lineString.coordinates.length >= 2) {
                            var routeData = <Common.RouteData> { segments: [], name: feature.properties.name || "" };
                            routeData.segments.push(<Common.RouteSegmentData> {
                                routePoint: latlngzs[0],
                                latlngzs: [latlngzs[0]],
                                routingType: Common.RoutingType.hike,
                            });
                            routeData.segments.push(<Common.RouteSegmentData> {
                                routePoint: latlngzs[latlngzs.length - 1],
                                latlngzs: latlngzs,
                                routingType: Common.RoutingType.hike,
                            });
                            data.routes.push(routeData);
                        }
                    }
                    if (feature.geometry.type == BaseParser.POINT) {
                        var point = <GeoJSON.Point>feature.geometry;
                        var marker = this.createMarker(point.coordinates, feature.properties.name)
                        data.markers.push(marker);
                    }
                }
            });
            data.bounds = leaftletGeoJson.getBounds();
            return data;
        }

        private createMarker(coordinates: GeoJSON.Position, message?: string): Common.MarkerData {
            return <Common.MarkerData> {
                latlng: this.createLatlng(coordinates),
                title: message,
            };
        }

        private createLatlng(coordinates: GeoJSON.Position): Common.LatLngZ {
            var latlngz = <Common.LatLngZ>new L.LatLng(coordinates[1], coordinates[0]);
            latlngz.z = coordinates[2] || 0; 
            return latlngz;
        }

        public toGeoJson(data: Common.DataContainer): GeoJSON.FeatureCollection {
            var geoJson = <GeoJSON.FeatureCollection> {
                type: BaseParser.FEATURE_COLLECTION,
                crs: {
                    type: "name",
                    properties: {
                        name: "EPSG:3857"
                    }
                },
                features: <GeoJSON.Feature[]>[],
            };
            for (var markerIndex = 0; markerIndex < data.markers.length; markerIndex++) {
                var marker = data.markers[markerIndex];
                geoJson.features.push(<GeoJSON.Feature>{
                    type: BaseParser.FEATURE,
                    properties: {
                        name: marker.title
                    },
                    geometry: <GeoJSON.Point> {
                        type: BaseParser.POINT,
                        coordinates: [marker.latlng.lng, marker.latlng.lat]
                    }
                });
            }

            for (var routeIndex = 0; routeIndex < data.routes.length; routeIndex++) {
                var routeData = data.routes[routeIndex];
                var lineStringCoordinates = <GeoJSON.Position[]>[];
                var pointsSegments = routeData.segments;
                for (var pointSegmentIndex = 0; pointSegmentIndex < pointsSegments.length; pointSegmentIndex++) {
                    for (var latlngIndex = 0; latlngIndex < pointsSegments[pointSegmentIndex].latlngzs.length; latlngIndex++) {
                        var latlngz = pointsSegments[pointSegmentIndex].latlngzs[latlngIndex];
                        lineStringCoordinates.push(<GeoJSON.Position>[latlngz.lng, latlngz.lat, latlngz.z]);
                    }
                }
                if (lineStringCoordinates.length > 0) {
                    var lineStringFeature = <GeoJSON.Feature> {
                        type: BaseParser.FEATURE,
                        properties: {
                            name: routeData.name,
                        },
                        geometry: <GeoJSON.LineString> {
                            type: BaseParser.LINE_STRING,
                            coordinates: lineStringCoordinates,
                        }
                    };
                    geoJson.features.push(lineStringFeature);
                }
            }
            return geoJson;
        }
    }
}