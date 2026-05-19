import { describe, beforeEach, it, expect } from "vitest";
import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

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
            imports: [NgxsModule.forRoot()],
            providers: [
                GeoJsonParser,
                SearchResultsProvider,
                CoordinatesService,
                { provide: RunningContextService, useValue: { isOnline: true } },
                { provide: PoiService, useValue: null },
                {
                    provide: ResourcesService, useValue: {
                        getCurrentLanguageCodeSimplified: () => "en"
                    }
                },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get empty array in case of short search term", (inject([SearchResultsProvider, HttpTestingController],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController) => {
            const promise = provider.getResults("a", false);

            mockBackend.expectNone(url => true);
            const results = await promise;
            expect(results.length).toBe(0);
        }
    )));

    it("Should get empty array in case of whitespace search term", (inject([SearchResultsProvider, HttpTestingController],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController) => {
            const promise = provider.getResults("   ", false);

            mockBackend.expectNone(url => true);
            const results = await promise;
            expect(results.length).toBe(0);
        }
    )));

    it("Should get all coordinates results", (inject([SearchResultsProvider, HttpTestingController, Store],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                locationState: {}
            })
            const promise = provider.getResults("32 35", false);

            mockBackend.expectNone(url => true);
            const results = await promise;
            expect(results.length).toBe(1);
            expect(results[0].source).toBe("Coordinates");
        }
    )));

    it("Should get results for search term", (inject([SearchResultsProvider, HttpTestingController, Store],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                locationState: {}
            })
            const promise = provider.getResults("searchTerm", false);

            mockBackend.match(() => true)[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            const results = await promise;
            expect(results.length).toBe(1);
        }
    )));

    it("Should return null in case of parallel requests", (inject([SearchResultsProvider, HttpTestingController, Store],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                locationState: {}
            })
            const promise1 = provider.getResults("searchTerm1", true);
            const promise2 = provider.getResults("searchTerm2", false);

            mockBackend.match(url => url.url.endsWith("searchTerm1"))[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            mockBackend.match(url => url.url.endsWith("searchTerm2"))[0].flush([{ id: "43" } as SearchResultsPointOfInterest]);
            const results1 = await promise1;
            const results2 = await promise2;
            expect(results1).toBeNull();
            expect(results2.length).toBe(1);
        }
    )));

    it("Should return null for prefix search term in case of parallel requests and full searched returned later", (inject([SearchResultsProvider, HttpTestingController, Store],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                locationState: {}
            });
            const promise1 = provider.getResults("searchTerm", true);
            const promise2 = provider.getResults("searchTerm", false);

            mockBackend.match(url => url.url.endsWith("searchTerm") && url.params.get("prefix") === "true")[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            mockBackend.match(url => url.url.endsWith("searchTerm") && url.params.get("prefix") === "false")[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            const results1 = await promise1;
            const results2 = await promise2;
            expect(results1.length).toBe(1);
            expect(results2.length).toBe(1);
        }
    )));

    it("Should return null for prefix search term in case of parallel requests and full searched returned earlier", (inject([SearchResultsProvider, HttpTestingController, Store],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController, store: Store) => {
            store.reset({
                locationState: {}
            });
            const promise1 = provider.getResults("searchTerm", true);
            const promise2 = provider.getResults("searchTerm", false);

            mockBackend.match(url => url.url.endsWith("searchTerm") && url.params.get("prefix") === "false")[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            mockBackend.match(url => url.url.endsWith("searchTerm") && url.params.get("prefix") === "true")[0].flush([{ id: "42" } as SearchResultsPointOfInterest]);
            const results1 = await promise1;
            const results2 = await promise2;

            expect(results1).toBeNull();
            expect(results2.length).toBe(1);
        }
    )));
});
