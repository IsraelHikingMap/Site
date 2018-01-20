import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { GeoJsonParser } from "../services/geojson.parser";
import { IPointOfInterestExtended } from "./poi.service";
import { Urls } from "../common/Urls";


export interface ISearchResults extends IPointOfInterestExtended {
    bounds: L.LatLngBounds;
    displayName: string;
}

@Injectable()
export class SearchResultsProvider {

    constructor(private httpClient: HttpClient) {
    }

    public getResults = async (searchTerm: string, isHebrew: boolean): Promise<ISearchResults[]> => {
        let params = new HttpParams();
        params = isHebrew ? params : params.set("language", "en");
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        let data = await this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params: params
        }).toPromise() as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
        let results = [] as ISearchResults[];
        let language = isHebrew ? "he" : "en";
        for (let feature of data.features) {
            // HM TODO: change search results to POIs?
            let properties = feature.properties as any;
            try {
                let singleResult = {
                    title: this.getName(properties, language),
                    icon: properties.icon,
                    iconColor: properties.iconColor,
                    source: properties.poiSource,
                    id: properties.identifier,
                    type: properties.osmType,
                    location: L.latLng(properties.geolocation.lat, properties.geolocation.lon, properties.geolocation.alt),
                    isRoute: feature.geometry.type !== "Point"
                } as ISearchResults;
                let geo = L.geoJSON(feature);
                singleResult.bounds = geo.getBounds();
                let address = GeoJsonParser.getPropertyValue(properties, "address", language);
                singleResult.displayName = singleResult.title + (address ? `, ${address}` : "");
                results.push(singleResult);
            }
            catch (error) {
                console.error(error + " feature: " + JSON.stringify(feature));
            }
        }
        return results;
    }

    private getName(properties: {}, language: string): string {
        let name = GeoJsonParser.getPropertyValue(properties, "name", language);
        if (name) {
            return name;
        }
        let resultsArray = _.pick(properties, (value: string, key: any) => key.contains("name"));
        return resultsArray[0];
    }
}