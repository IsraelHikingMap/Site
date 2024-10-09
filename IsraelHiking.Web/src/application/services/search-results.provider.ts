import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { PoiService } from "./poi.service";
import { CoordinatesService } from "./coordinates.service";
import { RouteStrings, getIdFromLatLng } from "./hash.service";
import { Urls } from "../urls";
import type { SearchResultsPointOfInterest } from "../models/models";

@Injectable()
export class SearchResultsProvider {

    private readonly httpClient = inject(HttpClient);
    private readonly poiService = inject(PoiService);
    private readonly coordinatesService = inject(CoordinatesService);

    public async getResults(searchTerm: string, isHebrew: boolean): Promise<SearchResultsPointOfInterest[]> {
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
        try {
            const language = isHebrew ? "he" : "en";
            const params = new HttpParams().set("language", language);
            const response = await firstValueFrom(this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
                params
            }).pipe(timeout(3000)));
            return response as SearchResultsPointOfInterest[];
        } catch {
            return await this.poiService.getSerchResults(searchWithoutBadCharacters);
        }
    }
}
