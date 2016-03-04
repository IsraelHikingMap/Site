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
            var collection = <GeoJSON.FeatureCollection> {
                features: [
                    <GeoJSON.Feature>{
                        type: "Feature",
                        properties: {
                            name: "point"
                        },
                        geometry: <GeoJSON.Point> {
                            type: "Point",
                            coordinates: [102.0, 0.5]
                        }    
                    },
                    <GeoJSON.Feature>{
                        type: "Feature",
                        properties: {
                            name: "LineString"
                        },
                        geometry: <GeoJSON.LineString>{
                            type: "LineString",
                            coordinates: [[102.0, 0.0], [103.0, 1.0], [104.0, 0.0], [105.0, 1.0]]
                        }
                    }
                ]
            };

            var data = geoJsonParser.parse(JSON.stringify(collection));
            expect(data.markers.length).toBe(1);
        });

        it("Should convert data container to geojson", () => {
            var data = <Common.DataContainer>{
                markers: [
                    { title: "marker", latlng: L.latLng(1, 1) } as Common.MarkerData
                ],
                routes: []
            };
            var geoJson = JSON.parse(geoJsonParser.toString(data)) as GeoJSON.FeatureCollection;
            expect(geoJson.features.length).toBe(1);
        });
    });
}