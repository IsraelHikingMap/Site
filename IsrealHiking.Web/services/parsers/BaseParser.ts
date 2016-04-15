module IsraelHiking.Services.Parsers {
    export abstract class BaseParser implements IParser {

        public parse(content: string): Common.DataContainer {
            var geojson = this.parseToGeoJson(content);
            return this.toDataContainer(geojson);
        }
        // should be implemented in derived class
        protected parseToGeoJson(content: string): GeoJSON.FeatureCollection<GeoJSON.GeometryObject> { return null; }
        // should be implemented in derived class
        public toString(data: Common.DataContainer): string { return ""; }

        public toDataContainer(geoJson: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>): Common.DataContainer {

            var data = {
                markers: [] as Common.MarkerData[],
                routes: [] as Common.RouteData[]
            } as Common.DataContainer;
            let leaftletGeoJson = L.geoJson(geoJson, {
                onEachFeature: (feature: GeoJSON.Feature<GeoJSON.GeometryObject>) => {
                    let routeData = null;
                    switch (feature.geometry.type) {
                        case Common.GeoJsonFeatureType.point:
                            let point = feature.geometry as GeoJSON.Point;
                            let marker = this.createMarker(point.coordinates, feature.properties.name);
                            data.markers.push(marker);
                            break;
                        case Common.GeoJsonFeatureType.multiPoint:
                            let points = feature.geometry as GeoJSON.MultiPoint;
                            for (let pointIndex = 0; pointIndex < points.coordinates.length; pointIndex++) {
                                let marker = this.createMarker(points.coordinates[pointIndex], feature.properties.name);
                                data.markers.push(marker);
                            }
                            break;
                        case Common.GeoJsonFeatureType.lineString:
                            let lineString = feature.geometry as GeoJSON.LineString;
                            routeData = this.positionsToData(lineString.coordinates, data, feature.properties.name);
                            break;
                        case Common.GeoJsonFeatureType.multiLineString:
                            let multiLineString = feature.geometry as GeoJSON.MultiLineString;
                            routeData = this.coordinatesArrayToData(multiLineString.coordinates, data, feature.properties.name);
                            break;
                        case Common.GeoJsonFeatureType.polygone:
                            let polygone = feature.geometry as GeoJSON.Polygon;
                            routeData = this.coordinatesArrayToData(polygone.coordinates, data, feature.properties.name);
                            break;
                        case Common.GeoJsonFeatureType.multiPolygon:
                            let multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                            routeData = ({ name: feature.properties.name || "", segments: [] } as Common.RouteData);
                            for (let polygoneCoordinates of multiPolygone.coordinates) {
                                let route = this.coordinatesArrayToData(polygoneCoordinates, data, feature.properties.name);
                                routeData.segments.concat(route.segments);
                            }
                            break;
                    }
                    if (routeData && routeData.segments.length > 0) {
                        data.routes.push(routeData);
                    }
                }
            } as L.GeoJSONOptions);
            data.northEast = leaftletGeoJson.getBounds().getNorthEast();
            data.southWest = leaftletGeoJson.getBounds().getSouthWest();
            return data;
        }

        private createMarker(coordinates: GeoJSON.Position, message?: string): Common.MarkerData {
            return {
                latlng: BaseParser.createLatlng(coordinates),
                title: message
            } as Common.MarkerData;
        }

        public static createLatlng(coordinates: GeoJSON.Position): Common.LatLngZ {
            let latlngz = new L.LatLng(coordinates[1], coordinates[0]) as Common.LatLngZ;
            latlngz.z = coordinates[2] || 0;
            return latlngz;
        }

        public static createLatlngArray(coordinates: GeoJSON.Position[]): Common.LatLngZ[] {
            let latlngzs = [] as Common.LatLngZ[];
            for (let pointCoordinates of coordinates) {
                latlngzs.push(BaseParser.createLatlng(pointCoordinates));
            }
            return latlngzs;
        }

        private positionsToData(positions: GeoJSON.Position[], data: Common.DataContainer, name: string): Common.RouteData {
            
            var routeData = { segments: [], name: name || "" } as Common.RouteData;
            var latlngzs = BaseParser.createLatlngArray(positions);
            if (latlngzs.length < 2) {
                return routeData;
            }
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
            return routeData;
        }

        private coordinatesArrayToData(coordinates: GeoJSON.Position[][], data: Common.DataContainer, name: string): Common.RouteData {
            let routeData = { name: name || "", segments: [] } as Common.RouteData;
            for (let lineCoordinates of coordinates) {
                if (lineCoordinates.length <= 0) {
                    continue;
                }
                if (routeData.segments.length === 0) {
                    let latLng = BaseParser.createLatlng(lineCoordinates[0]);
                    routeData.segments.push({
                        latlngzs: [latLng, latLng],
                        routePoint: latLng,
                        routingType: Common.RoutingType.hike
                    } as Common.RouteSegmentData);
                }
                let latlngzs = BaseParser.createLatlngArray(lineCoordinates);
                if (latlngzs.length >= 2) {
                    routeData.segments.push({
                        latlngzs: latlngzs,
                        routePoint: latlngzs[0],
                        routingType: Common.RoutingType.hike
                    } as Common.RouteSegmentData);
                }
            }
            return routeData;
        }

        public toGeoJson(data: Common.DataContainer): GeoJSON.FeatureCollection<GeoJSON.GeometryObject> {
            var geoJson = {
                type: Common.GeoJsonFeatureType.featureCollection,
                crs: {
                    type: "name",
                    properties: {
                        name: "EPSG:3857"
                    }
                },
                features: [] as GeoJSON.Feature<GeoJSON.GeometryObject>[]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            for (let marker of data.markers) {
                geoJson.features.push({
                    type: Common.GeoJsonFeatureType.feature,
                    properties: {
                        name: marker.title
                    },
                    geometry: {
                        type: Common.GeoJsonFeatureType.point,
                        coordinates: [marker.latlng.lng, marker.latlng.lat]
                    } as GeoJSON.Point
                } as GeoJSON.Feature<GeoJSON.GeometryObject>);
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
                        type: Common.GeoJsonFeatureType.feature,
                        properties: {
                            name: routeData.name,
                            creator: "IsraelHikingMap"
                        },
                        geometry: {
                            type: Common.GeoJsonFeatureType.multiLineString,
                            coordinates: multiLineStringCoordinates
                        } as GeoJSON.MultiLineString
                    } as GeoJSON.Feature<GeoJSON.GeometryObject>;
                    geoJson.features.push(multiLineStringFeature);
                }
            }
            return geoJson;
        }
    }
}