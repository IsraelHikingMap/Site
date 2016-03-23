module IsraelHiking.Services.Parsers {
    export abstract class BaseParser implements IParser {
        private static FEATURE_COLLECTION = "FeatureCollection";
        private static FEATURE = "Feature";
        private static LINE_STRING = "LineString";
        private static MULTI_LINE_STRING = "MultiLineString";
        private static POINT = "Point";
        private static MULTI_POINT = "MultiPoint";

        public parse(content: string): Common.DataContainer {
            var geojson = this.parseToGeoJson(content);
            return this.toDataContainer(geojson);
        }
        // should be implemented in derived class
        protected parseToGeoJson(content: string): GeoJSON.FeatureCollection { return null; }
        // should be implemented in derived class
        public toString(data: Common.DataContainer): string { return ""; }

        public toDataContainer(geoJson: GeoJSON.FeatureCollection): Common.DataContainer {

            var data = {
                markers: [] as Common.MarkerData[],
                routes: [] as Common.RouteData[]
            } as Common.DataContainer;

            var leaftletGeoJson = L.geoJson(geoJson, {
                onEachFeature: (feature: GeoJSON.Feature) => {
                    if (feature.geometry.type === BaseParser.LINE_STRING) {
                        var lineString = feature.geometry as GeoJSON.LineString;
                        this.positionsToData(lineString.coordinates, data, feature.properties.name);
                    }

                    if (feature.geometry.type === BaseParser.MULTI_LINE_STRING) {
                        var multiLineString = feature.geometry as GeoJSON.MultiLineString;
                        this.multiLineStringToData(multiLineString, data, feature.properties.name);
                    }
                    if (feature.geometry.type === BaseParser.MULTI_POINT) {
                        let points = feature.geometry as GeoJSON.MultiPoint;
                        for (let pointIndex = 0; pointIndex < points.coordinates.length; pointIndex++) {
                            let marker = this.createMarker(points.coordinates[pointIndex], feature.properties.name);
                            data.markers.push(marker);
                        }
                    }

                    if (feature.geometry.type === BaseParser.POINT) {
                        let point = feature.geometry as GeoJSON.Point;
                        let marker = this.createMarker(point.coordinates, feature.properties.name);
                        data.markers.push(marker);
                    }
                }
            } as L.GeoJSONOptions);
            data.northEast = leaftletGeoJson.getBounds().getNorthEast();
            data.southWest = leaftletGeoJson.getBounds().getSouthWest();
            return data;
        }

        private createMarker(coordinates: GeoJSON.Position, message?: string): Common.MarkerData {
            return {
                latlng: this.createLatlng(coordinates),
                title: message
            } as Common.MarkerData;
        }

        private createLatlng(coordinates: GeoJSON.Position): Common.LatLngZ {
            var latlngz = new L.LatLng(coordinates[1], coordinates[0]) as Common.LatLngZ;
            latlngz.z = coordinates[2] || 0; 
            return latlngz;
        }

        private positionsToData(positions: GeoJSON.Position[], data: Common.DataContainer, name: string) {
            var latlngzs = new Array<Common.LatLngZ>(positions.length);
            for (let coordinate = 0; coordinate < positions.length; coordinate++) {
                var pointCoordinates = positions[coordinate];
                latlngzs[coordinate] = this.createLatlng(pointCoordinates);
            }
            if (positions.length >= 2) {
                var routeData = { segments: [], name: name || "" } as Common.RouteData;
                routeData.segments.push({
                    routePoint: latlngzs[0],
                    latlngzs: [latlngzs[0], latlngzs[0]],
                    routingType: Common.RoutingType.hike
                } as Common.RouteSegmentData);
                routeData.segments.push({
                    routePoint: latlngzs[latlngzs.length - 1],
                    latlngzs: latlngzs,
                    routingType: Common.RoutingType.hike
                } as Common.RouteSegmentData);
                data.routes.push(routeData);
            }
        }

        private multiLineStringToData(multiLineString: GeoJSON.MultiLineString, data: Common.DataContainer, name: string) {
            var routeData = {
                name: name,
                segments: []
            } as Common.RouteData;
            for (let lineCoordinates of multiLineString.coordinates) {
                if (lineCoordinates.length <= 0) {
                    continue;
                }
                if (routeData.segments.length === 0) {
                    let latLng = this.createLatlng(lineCoordinates[0]);
                    routeData.segments.push({
                        latlngzs: [latLng, latLng],
                        routePoint: latLng,
                        routingType: Common.RoutingType.hike
                    } as Common.RouteSegmentData);
                }
                let latlngzs = [];
                for (let pointCoordinates of lineCoordinates) {
                    latlngzs.push(this.createLatlng(pointCoordinates));
                }
                if (latlngzs.length >= 2) {
                    routeData.segments.push({
                        latlngzs: latlngzs,
                        routePoint: latlngzs[0],
                        routingType: Common.RoutingType.hike
                    } as Common.RouteSegmentData);
                }
            }
            data.routes.push(routeData);
        }

        public toGeoJson(data: Common.DataContainer): GeoJSON.FeatureCollection {
            var geoJson = {
                type: BaseParser.FEATURE_COLLECTION,
                crs: {
                    type: "name",
                    properties: {
                        name: "EPSG:3857"
                    }
                },
                features: [] as GeoJSON.Feature[]
            } as GeoJSON.FeatureCollection;

            for (let marker of data.markers) {
                geoJson.features.push({
                    type: BaseParser.FEATURE,
                    properties: {
                        name: marker.title
                    },
                    geometry: {
                        type: BaseParser.POINT,
                        coordinates: [marker.latlng.lng, marker.latlng.lat]
                    } as GeoJSON.Point
                } as GeoJSON.Feature);
            }

            for (let routeData of data.routes) {
                let multiLineStringCoordinates = [] as GeoJSON.Position[][];

                for (let segment of routeData.segments) {
                    let lineStringCoordinates = [] as GeoJSON.Position[];
                    for (let latlngz of segment.latlngzs) {
                        lineStringCoordinates.push([latlngz.lng, latlngz.lat, latlngz.z] as GeoJSON.Position);
                    }
                    multiLineStringCoordinates.push(lineStringCoordinates);
                }
                if (multiLineStringCoordinates.length > 0) {
                    let multiLineStringFeature = {
                        type: BaseParser.FEATURE,
                        properties: {
                            name: routeData.name,
                            creator: "IsraelHikingMap"
                        },
                        geometry: {
                            type: BaseParser.MULTI_LINE_STRING,
                            coordinates: multiLineStringCoordinates
                        } as GeoJSON.MultiLineString
                    } as GeoJSON.Feature;
                    geoJson.features.push(multiLineStringFeature);
                }
            }
            return geoJson;
        }
    }
}