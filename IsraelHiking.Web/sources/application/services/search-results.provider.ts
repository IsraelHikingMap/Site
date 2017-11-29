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

    constructor(private httpClient: HttpClient,
        private geoJsonParser: GeoJsonParser) {
    }

    public getResults = async (searchTerm: string, isHebrew: boolean): Promise<ISearchResults[]> => {
        let params = new HttpParams();
        params = isHebrew ? params : params.set("language", "en");
        let searchWithoutBadCharacters = searchTerm.replace("/", " ").replace("\t", " ");
        let data = await this.httpClient.get(Urls.search + encodeURIComponent(searchWithoutBadCharacters), {
            params: params
        }).toPromise() as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
        let results = [] as ISearchResults[];
        for (let feature of data.features) {
            // HM TODO: change search results to POIs?
            let properties = feature.properties as any;
            try {
                let singleResult = {
                    title: this.getName(feature, isHebrew),
                    icon: properties.icon,
                    iconColor: properties.iconColor,
                    source: properties.poiSource,
                    id: properties.identifier,
                    type: properties.poiType,
                    location: L.latLng(properties.geolocation.lat, properties.geolocation.lon, properties.geolocation.alt),
                    isRoute: feature.geometry.type !== "Point"
                } as ISearchResults;
                let geo = L.geoJSON(feature);
                singleResult.bounds = geo.getBounds();
                let address = isHebrew ? properties.address : feature.properties["address:en"];
                singleResult.displayName = singleResult.title + (address ? `, ${address}` : "");
                results.push(singleResult);
            }
            catch (error) {
                console.error(error);
                console.log(feature);
            }
        }
        return results;
    }

    private getName(feature: GeoJSON.Feature<GeoJSON.GeometryObject>, isHebrew: boolean): string {
        let properties = feature.properties as any;
        let name = isHebrew
            ? properties.name || feature.properties["name:he"]
            : feature.properties["name:en"] || properties.name;
        if (name) {
            return name;
        }
        let resultsArray = _.pick(feature.properties, (value: string, key: any) => key.contains("name"));
        return resultsArray[0];
    }
}