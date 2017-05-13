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
            let leaftletGeoJson = L.geoJSON(geoJson, {
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

        public static createLatlng(coordinates: GeoJSON.Position): L.LatLng {
            return new L.LatLng(coordinates[1], coordinates[0], coordinates[2] || 0);
        }

        public static createLatlngArray(coordinates: GeoJSON.Position[]): L.LatLng[] {
            let latlngs = [] as L.LatLng[];
            for (let pointCoordinates of coordinates) {
                latlngs.push(GeoJsonParser.createLatlng(pointCoordinates));
            }
            return latlngs;
        }

        private positionsToData(positions: GeoJSON.Position[], name: string): Common.RouteData {

            var routeData = { segments: [], markers: [], name: name || "" } as Common.RouteData;
            var latlngs = GeoJsonParser.createLatlngArray(positions);
            if (latlngs.length < 2) {
                return routeData;
            }
            routeData.segments.push({
                routePoint: latlngs[0],
                latlngs: [latlngs[0], latlngs[0]],
                routingType: "Hike"
            } as Common.RouteSegmentData);
            routeData.segments.push({
                routePoint: latlngs[latlngs.length - 1],
                latlngs: latlngs,
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
                        latlngs: [latLng, latLng],
                        routePoint: latLng,
                        routingType: "Hike"
                    } as Common.RouteSegmentData);
                }
                let latlngs = GeoJsonParser.createLatlngArray(lineCoordinates);
                if (latlngs.length >= 2) {
                    routeData.segments.push({
                        latlngs: latlngs,
                        routePoint: latlngs[0],
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
                    for (let latlng of segment.latlngs) {
                        lineStringCoordinates.push([latlng.lng, latlng.lat, latlng.alt || 0] as GeoJSON.Position);
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