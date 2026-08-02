import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";

import { CoordinatesService } from "./coordinates.service";
import { RouteStrings, getIdFromLatLng } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";
import type { ApplicationState, SearchResultsPointOfInterest } from "../models";

const PREFIX_RANK = 0;
const FULL_RANK = 1;

@Injectable()
export class SearchResultsProvider {

    private readonly httpClient = inject(HttpClient);
    private readonly coordinatesService = inject(CoordinatesService);
    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);

    /**
     * The term of the most recently started search, and the rank of the best results already
     * returned for it, so that a stale response never overwrites a fresher one.
     * A term is searched twice - once as a prefix for fast results and once in full for accurate
     * ones - so the full results (rank 1) supersede the prefix results (rank 0) for the same term.
     * Note that these are shared by all the consumers of this service, which currently has a
     * single one, adding another one will make them invalidate each other's results.
     */
    private latestTerm: string = null;
    private latestReturnedRank = PREFIX_RANK - 1;

    public async getResults(searchTerm: string, isPrefix: boolean, useMapCenter: boolean): Promise<SearchResultsPointOfInterest[]> {
        const searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ").trim();
        if (searchWithoutBadCharacters !== this.latestTerm) {
            this.latestTerm = searchWithoutBadCharacters;
            this.latestReturnedRank = PREFIX_RANK - 1;
        }
        if (searchWithoutBadCharacters.length <= 2) {
            return [];
        }

        const latlng = this.coordinatesService.parseCoordinates(searchWithoutBadCharacters);
        if (latlng) {
            const id = getIdFromLatLng(latlng);
            return [{
                id,
                displayName: searchWithoutBadCharacters || id,
                title: id,
                source: RouteStrings.COORDINATES,
                icon: "icon-globe",
                iconColor: "black",
                location: latlng,
                description: "",
                hasExtraData: false
            }];
        }
        let params = new HttpParams()
            .set("language", this.resources.getCurrentLanguageCodeSimplified())
            .set("prefix", isPrefix);
        if (useMapCenter) {
            const location = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
            params = params
                .set("lat", location.latitude)
                .set("lng", location.longitude)
                .set("zoom", location.zoom);
        }
        const results = await firstValueFrom(this.httpClient.get<SearchResultsPointOfInterest[]>(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params
        }).pipe(timeout(5000)));
        if (searchWithoutBadCharacters !== this.latestTerm) {
            // A newer term was searched while this request was in flight - ignore this stale response
            return null;
        }
        const rank = isPrefix ? PREFIX_RANK : FULL_RANK;
        if (rank < this.latestReturnedRank) {
            // Better results for this term were already returned - don't downgrade them
            return null;
        }
        this.latestReturnedRank = rank;
        return results;

        // HM TODO: think if there's a way to have offline search results
    }
}
