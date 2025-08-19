import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { CoordinatesService } from "./coordinates.service";
import { RouteStrings, getIdFromLatLng } from "./hash.service";
import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";
import type { SearchResultsPointOfInterest } from "../models";

@Injectable()
export class SearchResultsProvider {

    private readonly httpClient = inject(HttpClient);
    private readonly coordinatesService = inject(CoordinatesService);
    private readonly resources = inject(ResourcesService)

    public async getResults(searchTerm: string): Promise<SearchResultsPointOfInterest[]> {
        const searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
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
            }];
        }
        const params = new HttpParams().set("language", this.resources.getCurrentLanguageCodeSimplified());
        return await firstValueFrom(this.httpClient.get<SearchResultsPointOfInterest[]>(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params
        }).pipe(timeout(3000)));
        // HM TODO: think if there's a way to have offline search results
    }
}
