import { GeoJsonParser } from "./geojson.parser";
import { MarkerData, RouteSegmentData, RouteData, DataContainer } from "../models/models";

describe("GeoJsonParser", () => {

    let geoJsonParser: GeoJsonParser;

    beforeEach(() => {
        geoJsonParser = new GeoJsonParser();
    });

    it("Should convert geoJson point", () => {
        let collection = {
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

        let data = geoJsonParser.toDataContainer(collection);
        expect(data.routes.length).toBe(1);
        expect(data.routes[0].markers.length).toBe(1);
    });

    it("Should parse geojson linestring", () => {
        let collection = {
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

        let data = geoJsonParser.toDataContainer(collection);
        expect(data.routes.length).toBe(1);
        expect(data.routes[0].markers.length).toBe(0);
    });

    it("Should parse empty linestring", () => {
        let collection = {
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

        let data = geoJsonParser.toDataContainer(collection);
        expect(data.routes.length).toBe(0);
    });

    it("Should parse complex geoJson", () => {
        let collection = {
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
                    coordinates: [[[9, 9], [10, 10], [9, 9]]]
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

        let data = geoJsonParser.toDataContainer(collection);
        expect(data.routes.length).toBe(4);
        expect(data.routes[0].markers.length).toBe(2);
    });

    it("Should convert geoJson MultilineString to different routes", () => {
        let collection = {
            type: "FeatureCollection",
            features: [{
                type: "Feature",
                properties: {
                    name: "multilinestring"
                },
                geometry: {
                    type: "MultiLineString",
                    coordinates: [[[1,1], [2,2]], [[3,3], [4,4]]]
                } as GeoJSON.MultiLineString
            } as GeoJSON.Feature<GeoJSON.MultiLineString>]
        } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

        let data = geoJsonParser.toDataContainer(collection);
        expect(data.routes.length).toBe(2);
        expect(data.routes[0].markers.length).toBe(0);
        expect(data.routes[1].name.endsWith("1")).toBeTruthy();
    });

    it("Should convert data container to geojson", () => {
        let data = {
            routes: [
                {
                    name: "route",
                    markers: [
                        { title: "marker", latlng: { lat: 1, lng: 1 } } as MarkerData
                    ],
                    segments: [
                        {
                            latlngs: [{ lat: 1, lng: 1 }],
                            routePoint: { lat: 1, lng: 1 },
                            routingType: "Hike"
                        } as RouteSegmentData
                    ]
                } as RouteData
            ]
        } as DataContainer;
        let geoJson = geoJsonParser.toGeoJson(data);
        expect(geoJson.features.length).toBe(2);
        expect(geoJson.features[0].geometry.type).toBe("Point");
        expect(geoJson.features[1].geometry.type).toBe("MultiLineString");
    });
});
