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

@Injectable()
export class SearchResultsProvider {

    private readonly httpClient = inject(HttpClient);
    private readonly coordinatesService = inject(CoordinatesService);
    private readonly resources = inject(ResourcesService);
    private readonly store = inject(Store);

    private requestsQueue: string[] = [];

    public async getResults(searchTerm: string, isPrefix: boolean): Promise<SearchResultsPointOfInterest[]> {
        const searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ").trim();
        if (searchWithoutBadCharacters.length <= 2) {
            return [];
        }

        this.requestsQueue.push(searchWithoutBadCharacters);
        try {
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
            const location = this.store.selectSnapshot((state: ApplicationState) => state.locationState);
            const params = new HttpParams()
                .set("language", this.resources.getCurrentLanguageCodeSimplified())
                .set("lat", location.latitude)
                .set("lng", location.longitude)
                .set("zoom", location.zoom)
                .set("prefix", isPrefix);
            const results = await firstValueFrom(this.httpClient.get<SearchResultsPointOfInterest[]>(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
                params
            }).pipe(timeout(5000)));
            return this.requestsQueue[this.requestsQueue.length - 1] === searchWithoutBadCharacters ? results : null;
        }
        finally {
            if (isPrefix === false) {
                // remove all matching strings
                this.requestsQueue = this.requestsQueue.filter(s => s !== searchWithoutBadCharacters);
            } else {
                // remove last matching strings
                const lastIndex = this.requestsQueue.lastIndexOf(searchWithoutBadCharacters);
                if (lastIndex >= 0) {
                    this.requestsQueue.splice(lastIndex, 1);
                }
            }
        }

        // HM TODO: think if there's a way to have offline search results
    }
}
