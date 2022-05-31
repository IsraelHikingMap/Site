import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { PoiService } from "./poi.service";
import { CoordinatesService } from "./coordinates.service";
import { Urls } from "../urls";
import type { SearchResultsPointOfInterest } from "../models/models";

@Injectable()
export class SearchResultsProvider {

    constructor(private readonly httpClient: HttpClient,
                private readonly poiService: PoiService,
                private readonly coordinatesService: CoordinatesService) {
    }

    public async getResults(searchTerm: string, isHebrew: boolean): Promise<SearchResultsPointOfInterest[]> {
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        let latlng = this.coordinatesService.parseCoordinates(searchWithoutBadCharacters);
        if (latlng) {
            let id = this.poiService.getIdFromLatLng(latlng);
            return [{
                id,
                displayName: searchWithoutBadCharacters || id,
                title: id,
                source: "Coordinates",
                icon: "icon-globe",
                iconColor: "black",
                location: latlng,
                description: "",
            }];
        }
        try {
            let language = isHebrew ? "he" : "en";
            let params = new HttpParams().set("language", language);
            let response = await firstValueFrom(this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
                params
            }).pipe(timeout(3000)));
            return response as SearchResultsPointOfInterest[];
        } catch {
            return await this.poiService.getSerchResults(searchWithoutBadCharacters);
        }
    }
}
