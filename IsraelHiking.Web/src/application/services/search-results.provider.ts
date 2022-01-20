import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { PoiService } from "./poi.service";
import { Urls } from "../urls";
import type { SearchResultsPointOfInterest } from "../models/models";

@Injectable()
export class SearchResultsProvider {

    constructor(private readonly httpClient: HttpClient,
                private readonly poiService: PoiService) {
    }

    public async getResults(searchTerm: string, isHebrew: boolean): Promise<SearchResultsPointOfInterest[]> {
        let params = new HttpParams();
        let language = isHebrew ? "he" : "en";
        params = params.set("language", language);
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        try {
            let response = await firstValueFrom(this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
                params
            }).pipe(timeout(3000)));
            return response as SearchResultsPointOfInterest[];
        } catch {
            return await this.poiService.getSerchResults(searchWithoutBadCharacters);
        }
    }
}
