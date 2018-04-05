import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { GeoJsonParser } from "../services/geojson.parser";
import { IPointOfInterestExtended } from "./poi.service";
import { Urls } from "../common/Urls";

export interface ISearchResultsPointOfInterest extends IPointOfInterestExtended {
    displayName: string;
    northEast: L.LatLng;
    southWest: L.LatLng;
}

@Injectable()
export class SearchResultsProvider {

    constructor(private httpClient: HttpClient) {
    }

    public getResults = async (searchTerm: string, isHebrew: boolean): Promise<ISearchResultsPointOfInterest[]> => {
        let params = new HttpParams();
        let language = isHebrew ? "he" : "en";
        params = params.set("language", language);
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        let response = await this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params: params
        }).toPromise() as ISearchResultsPointOfInterest[];
        return response;
    }    
}