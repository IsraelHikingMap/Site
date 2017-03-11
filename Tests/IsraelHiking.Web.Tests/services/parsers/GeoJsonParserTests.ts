﻿/// <reference path="../../../../israelhiking.Web/scripts/typings/geojson/geojson.d.ts" />
/// <reference path="../../../../israelhiking.web/common/israelhiking.d.ts" />
/// <reference path="../../../../israelhiking.web/services/parsers/geojsonparser.ts" />

namespace IsraelHiking.Tests.Services.Parsers {
    describe("GeoJson Parser", () => {

        var geoJsonParser: IsraelHiking.Services.Parsers.GeoJsonParser;

        beforeEach(() => {
            geoJsonParser = new IsraelHiking.Services.Parsers.GeoJsonParser();
        });

        it("Should parse geoJson point", () => {
            var collection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    properties: {
                        name: "point"
                    },
                    geometry: {
                        type: "Point",
                        coordinates: [1, 1]
                    } as GeoJSON.Point
                } as GeoJSON.Feature<GeoJSON.Point>]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            var data = geoJsonParser.parse(JSON.stringify(collection));
            expect(data.routes.length).toBe(1);
            expect(data.routes[0].markers.length).toBe(1);
        });

        it("Should parse geojson linestring", () => {
            var collection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    properties: {
                        name: "LineString"
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: [[2, 2], [3, 3], [4, 4], [5, 5]]
                    } as GeoJSON.LineString
                } as GeoJSON.Feature<GeoJSON.LineString>
                ]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            var data = geoJsonParser.parse(JSON.stringify(collection));
            expect(data.routes.length).toBe(1);
            expect(data.routes[0].markers.length).toBe(0);
        });

        it("Should parse empty linestring", () => {
            var collection = {
                type: "FeatureCollection",
                features: [{
                    type: "Feature",
                    properties: {
                        name: "LineString"
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: []
                    } as GeoJSON.LineString
                } as GeoJSON.Feature<GeoJSON.LineString>
                ]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            var data = geoJsonParser.parse(JSON.stringify(collection));
            expect(data.routes.length).toBe(0);
        });

        it("Should parse complex geoJson string", () => {
            var collection = {
                type: "FeatureCollection",
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
                } as GeoJSON.Feature<GeoJSON.MultiLineString>,
                {
                    type: "Feature",
                    properties: {
                        name: "polygon"
                    },
                    geometry: {
                        type: "Polygon",
                        coordinates: [[[9, 9], [10, 10], [9,9]]]
                    } as GeoJSON.Polygon
                } as GeoJSON.Feature<GeoJSON.Polygon>,
                {
                    type: "Feature",
                    properties: {
                        name: "multiPolygon"
                    },
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: [[[[11, 11], [12, 12], [11, 11]]]]
                    } as GeoJSON.MultiPolygon
                } as GeoJSON.Feature<GeoJSON.MultiPolygon>
                ]
            } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            var data = geoJsonParser.parse(JSON.stringify(collection));
            expect(data.routes.length).toBe(4);
            expect(data.routes[0].markers.length).toBe(2);
        });

        it("Should convert data container to geojson", () => {
            var data = {
                routes: [
                    {
                        name: "route",
                        markers: [
                            { title: "marker", latlng: L.latLng(1, 1) } as Common.MarkerData
                        ],
                        segments: [
                            {
                                latlngzs: [L.latLng(1, 1) as Common.LatLngZ],
                                routePoint: L.latLng(1, 1),
                                routingType: "Hike"
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