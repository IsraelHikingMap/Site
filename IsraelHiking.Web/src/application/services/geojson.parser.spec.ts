import { GeoJsonParser } from "./geojson.parser";

describe("GeoJsonParser", () => {
    let geoJsonParser: GeoJsonParser;

    beforeEach(() => {
        geoJsonParser = new GeoJsonParser();
    });

    it("Should convert linestring to route", () => {
        const feature = {
            type: "Feature",
            properties: {
                name: "LineString"
            },
            geometry: {
                type: "LineString",
                coordinates: [[2, 2], [3, 3], [4, 4], [5, 5]]
            } as GeoJSON.LineString
        } as GeoJSON.Feature<GeoJSON.LineString>;

        const data = geoJsonParser.toRoutes(feature);
        expect(data.length).toBe(1);
        expect(data[0].latlngs.length).toBe(4);
    });

    it("Should parse empty linestring", () => {
        const feature = {
            type: "Feature",
            properties: {
                name: "LineString"
            },
            geometry: {
                type: "LineString",
                coordinates: []
            } as GeoJSON.LineString
        } as GeoJSON.Feature<GeoJSON.LineString>;

        const data = geoJsonParser.toRoutes(feature);
        expect(data.length).toBe(1);
    });

    it("Should convert geoJson MultilineString to different routes", () => {
        const feature = {
            type: "Feature",
            properties: {
                name: "multilinestring"
            },
            geometry: {
                type: "MultiLineString",
                coordinates: [[[1, 1], [2, 2]], [[3, 3], [4, 4]]]
            } as GeoJSON.MultiLineString
        } as GeoJSON.Feature<GeoJSON.MultiLineString>;

        const data = geoJsonParser.toRoutes(feature);
        expect(data.length).toBe(2);
        expect(data[0].latlngs.length).toBe(2);
        expect(data[1].name.endsWith("1")).toBeTruthy();
    });
});
