import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { SearchResultsProvider, ISearchResults } from "./search-results.provider";
import { GeoJsonParser } from "./geojson.parser";

describe("SearchResultsProvider", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                GeoJsonParser,
                SearchResultsProvider
            ]
        });
    });

    it("Should get all kind of features in results", (inject([SearchResultsProvider, HttpTestingController],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController) => {
            let features = [
                {
                    type: "Feature",
                    geometry: {
                        type: "Point",
                        coordinates: [1, 2]
                    } as GeoJSON.Point,
                    properties: {
                        name: "point",
                        "name:he": "nekuda",
                        geolocation: { lat: 1, lon: 2 },
                    }
                } as GeoJSON.Feature<GeoJSON.Point>,
                {
                    type: "Feature",
                    geometry: {
                        type: "LineString",
                        coordinates: [[1, 2], [3, 4]]
                    } as GeoJSON.LineString,
                    properties: {
                        name: "linestring",
                        geolocation: { lat: 1, lon: 2 },
                    }
                } as GeoJSON.Feature<GeoJSON.LineString>,
                {
                    type: "Feature",
                    geometry: {
                        type: "Polygon",
                        coordinates: [[[1, 2], [3, 4], [1, 2]]]
                    } as GeoJSON.Polygon,
                    properties: {
                        name: "polygon",
                        geolocation: { lat: 1, lon: 2 },
                    }
                } as GeoJSON.Feature<GeoJSON.Polygon>,
                {
                    type: "Feature",
                    geometry: {
                        type: "MultiLineString",
                        coordinates: [[[1, 2], [3, 4]], [[1, 2], [3, 4]]]
                    } as GeoJSON.MultiLineString,
                    properties: {
                        name: "multiline",
                        "name:en": "multiline",
                        geolocation: { lat: 1, lon: 2 }
                    }
                } as GeoJSON.Feature<GeoJSON.MultiLineString>,
                {
                    type: "Feature",
                    geometry: {
                        type: "MultiPolygon",
                        coordinates: [[[[1, 2], [3, 4], [1, 2]]]]
                    } as GeoJSON.MultiPolygon,
                    properties: {
                        "name:ar": "multipolygon",
                        geolocation: { lat: 1, lon: 2 },
                        altitude: 10
                    }
                } as GeoJSON.Feature<GeoJSON.MultiPolygon>
            ] as GeoJSON.Feature<GeoJSON.GeometryObject>[];
            let collection = { features: features } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;

            provider.getResults("searchTerm", true).then((results: ISearchResults[]) => {
                expect(results.length).toBe(5);
            }, fail);

            mockBackend.match(() => true)[0].flush(collection);
        })));
});