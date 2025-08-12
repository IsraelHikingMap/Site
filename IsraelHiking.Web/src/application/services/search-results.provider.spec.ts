import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { SearchResultsProvider } from "./search-results.provider";
import { GeoJsonParser } from "./geojson.parser";
import { RunningContextService } from "./running-context.service";
import { PoiService } from "./poi.service";
import { CoordinatesService } from "./coordinates.service";
import { ResourcesService } from "./resources.service";
import type { SearchResultsPointOfInterest } from "../models";

describe("SearchResultsProvider", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                GeoJsonParser,
                SearchResultsProvider,
                CoordinatesService,
                { provide: RunningContextService, useValue: { isOnline: true } },
                { provide: PoiService, useValue: null },
                { provide: ResourcesService, useValue: {
                    getCurrentLanguageCodeSimplified: () => "en"
                } },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get all kind of features in results", (inject([SearchResultsProvider, HttpTestingController],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController) => {
            const promise = provider.getResults("searchTerm").then((results: SearchResultsPointOfInterest[]) => {
                expect(results.length).toBe(1);
            }, fail);

            mockBackend.match(() => true)[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            return promise;
        })));
});
