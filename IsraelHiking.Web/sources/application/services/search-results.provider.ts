import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import * as L from "leaflet";
import * as _ from "lodash";

import { GeoJsonParser } from "../services/geojson.parser";
import { Urls } from "../common/Urls";


export interface ISearchResults {
    name: string;
    address: string;
    icon: string;
    searchTerm: string;
    latlng: L.LatLng;
    latlngsArray: L.LatLng[][];
    bounds: L.LatLngBounds;
    displayName: string;
    feature: GeoJSON.Feature<GeoJSON.GeometryObject>;
}

@Injectable()
export class SearchResultsProvider {

    constructor(private http: Http,
        private geoJsonParser: GeoJsonParser) {
    }

    public getResults = (searchTerm: string, isHebrew: boolean): Promise<ISearchResults[]> => {
        return new Promise((resolve, reject) => {
            var params = isHebrew ? {} : { language: "en" };
            this.http.get(Urls.search + encodeURIComponent(searchTerm.replace("/", " ")), {
                params: params
            }).toPromise().then((response) => {
                let data = response.json() as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
                let results = [] as ISearchResults[];
                for (let feature of data.features) {
                    let properties = feature.properties as any;
                    try {
                        let singleResult = {
                            name: this.getName(feature, isHebrew),
                            latlngsArray: this.geoJsonParser.toLatLngsArray(feature),
                            icon: properties.icon,
                            address: isHebrew ? properties.address : feature.properties["address:en"],
                            latlng: L.latLng(properties.geolocation.lat, properties.geolocation.lon, properties.altitude),
                            feature: feature
                        } as ISearchResults;
                        let geo = L.geoJSON(feature);
                        singleResult.bounds = geo.getBounds();
                        singleResult.displayName = singleResult.name + (singleResult.address ? `, ${singleResult.address}` : "");
                        results.push(singleResult);
                    }
                    catch (error) {
                        console.error(error);
                        console.log(feature);
                    }
                }
                resolve(results);
            }, (err) => {
                reject(err);
            });
        });
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