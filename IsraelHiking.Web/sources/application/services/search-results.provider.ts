import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { Urls } from "../urls";
import { LatLngAlt, PointOfInterestExtended } from "../models/models";

export interface ISearchResultsPointOfInterest extends PointOfInterestExtended {
    displayName: string;
    northEast: LatLngAlt;
    southWest: LatLngAlt;
}

@Injectable()
export class SearchResultsProvider {

    constructor(private readonly httpClient: HttpClient) {
    }

    public getResults = async (searchTerm: string, isHebrew: boolean): Promise<ISearchResultsPointOfInterest[]> => {
        let params = new HttpParams();
        let language = isHebrew ? "he" : "en";
        params = params.set("language", language);
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        let response = await this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params
        }).toPromise() as ISearchResultsPointOfInterest[];
        return response;
    }
}
