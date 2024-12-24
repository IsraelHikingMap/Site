import { inject, Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { CoordinatesService } from "./coordinates.service";
import { RouteStrings, getIdFromLatLng } from "./hash.service";
import { Urls } from "../urls";
import type { SearchResultsPointOfInterest } from "../models/models";

type NominatimResponse = {
    display_name: string;
    lat: string;
    lon: string;
    type: string;
    name: string;
    osm_id: string;
    osm_type: string;
};

@Injectable()
export class SearchResultsProvider {

    private readonly httpClient = inject(HttpClient);
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
        const language = isHebrew ? "he" : "en";
        const response = await firstValueFrom(this.httpClient.get(Urls.nominatim + encodeURIComponent(searchWithoutBadCharacters), {
            headers: {
                "Accept-Language": language
            }
        }).pipe(timeout(3000))) as any as NominatimResponse[];
        return response.map((r: NominatimResponse) => {
            const latlng = { lat: +r.lat, lng: +r.lon };
            return {
                id: r.osm_type + "_" + r.osm_id,
                displayName: r.display_name,
                title: r.name,
                source: "OSM",
                icon: "icon-marker",
                iconColor: "black",
                location: latlng,
                description: "",
            };
        });
    }
}
