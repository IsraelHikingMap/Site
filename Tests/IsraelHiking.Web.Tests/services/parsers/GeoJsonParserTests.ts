/// <reference path="../../../../IsrealHiking.Web/scripts/typings/geojson/geojson.d.ts" />
/// <reference path="../../../../isrealhiking.web/services/parsers/iparser.ts" />
/// <reference path="../../../../isrealhiking.web/services/parsers/baseparser.ts" />
/// <reference path="../../../../isrealhiking.web/services/parsers/geojsonparser.ts" />

module IsraelHiking.Tests {
    describe("GeoJson Parser", () => {

        var geoJsonParser: Services.Parsers.GeoJsonParser;

        beforeEach(() => {
            geoJsonParser = new Services.Parsers.GeoJsonParser();
        });

        it("Should parse geoJson string", () => {
            var collection = {
                features: [{
                    type: "Feature",
                    properties: {
                        name: "point"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [1, 1]
                    } as GeoJSON.Point
                } as GeoJSON.Feature<GeoJSON.Point>, {
                    type: "Feature",
                    properties: {
                        name: "LineString"
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: [[2, 2], [3, 3], [4, 4], [5, 5]]
                    } as GeoJSON.LineString
                } as GeoJSON.Feature<GeoJSON.LineString>, {
                    type: "Feature",
                    properties: {
                        name: "multiPoint"
                    },
                    geometry: {
                        type: "MultiPoint",
                        coordinates: [[6, 6]]
                    } as GeoJSON.MultiPoint
                } as GeoJSON.Feature<GeoJSON.MultiPoint>, {
                    type: "Feature",
                    properties: {
                        name: "multiLineString"
                    },
                    geometry: {
                        type: "MultiLineString",
                        coordinates: [[[7, 7], [8, 8]], []]
                    } as GeoJSON.MultiLineString
                } as GeoJSON.Feature<GeoJSON.MultiLineString>]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            var data = geoJsonParser.parse(JSON.stringify(collection));
            expect(data.markers.length).toBe(2);
            expect(data.routes.length).toBe(2);
        });

        it("Should convert data container to geojson", () => {
            var data = {
                markers: [
                    { title: "marker", latlng: L.latLng(1, 1) } as Common.MarkerData
                ],
                routes: [
                    {
                        name: "route",
                        segments: [
                            {
                                latlngzs: [L.latLng(1, 1)],
                                routePoint: L.latLng(1, 1),
                                routingType: "h"
                            } as Common.RouteSegmentData
                        ]
                    } as Common.RouteData
                ]
            } as Common.DataContainer;
            var geoJson = JSON.parse(geoJsonParser.toString(data)) as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
            expect(geoJson.features.length).toBe(2);
            expect(geoJson.features[0].geometry.type).toBe("Point");
            expect(geoJson.features[1].geometry.type).toBe("MultiLineString");
        });
    });
}