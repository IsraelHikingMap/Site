import { Injectable } from "@angular/core";
import { Http } from "@angular/http";
import { GeoJsonParser, GeoJson } from "../services/GeoJsonParser";
import { Urls } from "../common/Urls";
import * as _ from "lodash";

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

    constructor(private http: Http) {
    }

    public getResults = (searchTerm: string, isHebrew: boolean): Promise<ISearchResults[]> => {
        return new Promise((resolve, reject) => {
            var params = isHebrew ? {} : { language: "en" };
            this.http.get(Urls.search + searchTerm, {
                params: params
            }).toPromise().then((response) => {
                let data = response.json() as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
                let results = [] as ISearchResults[];
                for (let feature of data.features) {
                    let properties = feature.properties as any;
                    let singleResult = {
                        name: this.getName(feature, isHebrew),
                        latlngsArray: [],
                        icon: properties.icon,
                        address: isHebrew ? properties.address : feature.properties["address:en"],
                        feature: feature
                    } as ISearchResults;
                    try {
                        switch (feature.geometry.type) {
                            case GeoJson.point:
                                var point = feature.geometry as GeoJSON.Point;
                                singleResult.latlng = GeoJsonParser.createLatlng(point.coordinates) as L.LatLng;
                                break;
                            case GeoJson.lineString:
                                var lineString = feature.geometry as GeoJSON.LineString;
                                singleResult.latlng = GeoJsonParser.createLatlng(lineString.coordinates[0]) as L.LatLng;
                                singleResult.latlngsArray.push(GeoJsonParser.createLatlngArray(lineString.coordinates));
                                break;
                            case GeoJson.multiLineString:
                                var multiLineString = feature.geometry as GeoJSON.MultiLineString;
                                singleResult.latlng = GeoJsonParser.createLatlng(multiLineString.coordinates[0][0]) as L.LatLng;
                                for (let currentCoordinatesArray of multiLineString.coordinates) {
                                    singleResult.latlngsArray.push(GeoJsonParser.createLatlngArray(currentCoordinatesArray));
                                }
                                break;
                            case GeoJson.polygon:
                                var polygone = feature.geometry as GeoJSON.Polygon;
                                singleResult.latlng = GeoJsonParser.createLatlng(polygone.coordinates[0][0]) as L.LatLng;
                                for (let currentCoordinatesArray of polygone.coordinates) {
                                    singleResult.latlngsArray.push(GeoJsonParser.createLatlngArray(currentCoordinatesArray));
                                }
                                break;
                            case GeoJson.multiPolygon:
                                var multiPolygone = feature.geometry as GeoJSON.MultiPolygon;
                                singleResult.latlng = GeoJsonParser.createLatlng(multiPolygone.coordinates[0][0][0]) as L.LatLng;
                                for (let currentPolygoneCoordinates of multiPolygone.coordinates) {
                                    for (let currentCoordinatesArray of currentPolygoneCoordinates) {
                                        singleResult.latlngsArray.push(GeoJsonParser.createLatlngArray(currentCoordinatesArray));
                                    }
                                }
                        }
                        if (properties.lat && properties.lng) {
                            singleResult.latlng = L.latLng(properties.lat, properties.lng);
                        }
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