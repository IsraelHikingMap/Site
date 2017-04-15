namespace IsraelHiking.Services.Parsers {
    export class GeoJsonParser {

        public parse(content: string): Common.DataContainer {
            let geojson = JSON.parse(content);
            return this.toDataContainer(geojson);
        }

        public toString(data: Common.DataContainer): string {
            var geoJson = this.toGeoJson(data);
            return JSON.stringify(geoJson);
        }

        public toDataContainer(geoJson: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>): Common.DataContainer {
            let markers = [];
            let data = {
                routes: [] as Common.RouteData[]
            } as Common.DataContainer;
            let leaftletGeoJson = L.geoJson(geoJson, {
                onEachFeature: (feature: GeoJSON.Feature<GeoJSON.GeometryObject>) => {
                    let routeData = null;
                    let name = (feature.properties as any).name;
                    switch (feature.geometry.type) {
                        case Strings.GeoJson.point:
                            var point = feature.geometry as GeoJSON.Point;
                            var marker = this.createMarker(point.coordinates, name);
                            markers.push(marker);
                            break;
                        case Strings.GeoJson.multiPoint:
                            var points = feature.geometry as GeoJSON.MultiPoint;
                            for (let pointIndex = 0; pointIndex < points.coordinates.length; pointIndex++) {
                                let marker = this.createMarker(points.coordinates[pointIndex], name);
                                markers.push(marker);
                            }
                            break;
                        case Strings.GeoJson.lineString:
                            var lineString = feature.geometry as GeoJSON.LineString;
                            routeData = this.positionsToData(lineString.coordinates, name);
                            break;
                        case Strings.GeoJson.multiLineString:
                            var multiLineString = feature.geometry as GeoJSON.MultiLineString;
                            routeData = this.coordinatesArrayToData(multiLineString.coordinates, name);
                            break;
                        case Strings.GeoJson.polygon:
                            var polygone = feature.geometry as GeoJSON.Polygon;
                            routeData = this.coordinatesArrayToData(polygone.coordinates, name);
                            break;
                        case Strings.GeoJson.multiPolygon:
                            var multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                            routeData = ({ name: name || "", segments: [] } as Common.RouteData);
                            for (let polygoneCoordinates of multiPolygone.coordinates) {
                                let route = this.coordinatesArrayToData(polygoneCoordinates, name);
                                routeData.segments = routeData.segments.concat(route.segments);
                            }
                            break;
                    }
                    if (routeData && routeData.segments.length > 0) {
                        data.routes.push(routeData);
                    }
                }
            } as L.GeoJSONOptions);
            if (markers.length > 0) {
                if (data.routes.length === 0) {
                    let name = markers.length === 1 ? markers[0].title || HashService.MARKERS : HashService.MARKERS;
                    data.routes.push({ name: name, segments: [], markers: [] });
                }
                data.routes[0].markers = markers;
            }
            data.northEast = leaftletGeoJson.getBounds().getNorthEast();
            data.southWest = leaftletGeoJson.getBounds().getSouthWest();
            return data;
        }

        private createMarker(coordinates: GeoJSON.Position, message?: string): Common.MarkerData {
            return {
                latlng: GeoJsonParser.createLatlng(coordinates),
                title: message,
                type: ""
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
                latlngzs.push(GeoJsonParser.createLatlng(pointCoordinates));
            }
            return latlngzs;
        }

        private positionsToData(positions: GeoJSON.Position[], name: string): Common.RouteData {

            var routeData = { segments: [], markers: [], name: name || "" } as Common.RouteData;
            var latlngzs = GeoJsonParser.createLatlngArray(positions);
            if (latlngzs.length < 2) {
                return routeData;
            }
            routeData.segments.push({
                routePoint: latlngzs[0],
                latlngzs: [latlngzs[0], latlngzs[0]],
                routingType: "Hike"
            } as Common.RouteSegmentData);
            routeData.segments.push({
                routePoint: latlngzs[latlngzs.length - 1],
                latlngzs: latlngzs,
                routingType: "Hike"
            } as Common.RouteSegmentData);
            return routeData;
        }

        private coordinatesArrayToData(coordinates: GeoJSON.Position[][], name: string): Common.RouteData {
            let routeData = { name: name || "", segments: [], markers: [] } as Common.RouteData;
            for (let lineCoordinates of coordinates) {
                if (lineCoordinates.length <= 0) {
                    continue;
                }
                if (routeData.segments.length === 0) {
                    let latLng = GeoJsonParser.createLatlng(lineCoordinates[0]);
                    routeData.segments.push({
                        latlngzs: [latLng, latLng],
                        routePoint: latLng,
                        routingType: "Hike"
                    } as Common.RouteSegmentData);
                }
                let latlngzs = GeoJsonParser.createLatlngArray(lineCoordinates);
                if (latlngzs.length >= 2) {
                    routeData.segments.push({
                        latlngzs: latlngzs,
                        routePoint: latlngzs[0],
                        routingType: "Hike"
                    } as Common.RouteSegmentData);
                }
            }
            return routeData;
        }

        public toGeoJson(data: Common.DataContainer): GeoJSON.FeatureCollection<GeoJSON.GeometryObject> {
            let geoJson = {
                type: "FeatureCollection",
                crs: {
                    type: "name",
                    properties: {
                        name: "EPSG:3857"
                    }
                } as GeoJSON.NamedCoordinateReferenceSystem,
                features: [] as GeoJSON.Feature<GeoJSON.GeometryObject>[]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            for (let routeData of data.routes) {
                for (let marker of routeData.markers) {
                    geoJson.features.push({
                        type: "Feature",
                        properties: {
                            name: marker.title
                        },
                        geometry: {
                            type: Strings.GeoJson.point,
                            coordinates: [marker.latlng.lng, marker.latlng.lat]
                        } as GeoJSON.Point
                    } as GeoJSON.Feature<GeoJSON.GeometryObject>);
                }

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
                        type: "Feature",
                        properties: {
                            name: routeData.name,
                            creator: "IsraelHikingMap"
                        },
                        geometry: {
                            type: Strings.GeoJson.multiLineString,
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