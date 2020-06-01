import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { SearchResultsProvider, ISearchResultsPointOfInterest } from "./search-results.provider";
import { GeoJsonParser } from "./geojson.parser";
import { RunningContextService } from "./running-context.service";
import { Device } from "@ionic-native/device/ngx";
import { PoiService } from "./poi.service";

describe("SearchResultsProvider", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                GeoJsonParser,
                SearchResultsProvider,
                { provide: RunningContextService, useValue: { isOnline: true } },
                { provide: PoiService, useValue: null }
            ]
        });
    });

    it("Should get all kind of features in results", (inject([SearchResultsProvider, HttpTestingController],
        async (provider: SearchResultsProvider, mockBackend: HttpTestingController) => {
            let promise = provider.getResults("searchTerm", true).then((results: ISearchResultsPointOfInterest[]) => {
                expect(results.length).toBe(1);
            }, fail);

            mockBackend.match(() => true)[0].flush([{ id: "42" } as ISearchResultsPointOfInterest]);
            return promise;
        })));
});
