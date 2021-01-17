import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { RunningContextService } from "./running-context.service";
import { PoiService } from "./poi.service";
import { Urls } from "../urls";
import { PointOfInterestExtended } from "../models/models";

export interface ISearchResultsPointOfInterest extends PointOfInterestExtended {
    displayName: string;
}

@Injectable()
export class SearchResultsProvider {

    constructor(private readonly httpClient: HttpClient,
                private readonly runningContextService: RunningContextService,
                private readonly poiService: PoiService) {
    }

    public getResults = async (searchTerm: string, isHebrew: boolean): Promise<ISearchResultsPointOfInterest[]> => {
        let params = new HttpParams();
        let language = isHebrew ? "he" : "en";
        params = params.set("language", language);
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        if (!this.runningContextService.isOnline) {
            let results = await this.poiService.getSerchResults(searchWithoutBadCharacters);
            return results.map(p => ({ ...p, displayName: p.title } as ISearchResultsPointOfInterest));
        }
        let response = await this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params
        }).toPromise() as ISearchResultsPointOfInterest[];
        return response;
    }
}
