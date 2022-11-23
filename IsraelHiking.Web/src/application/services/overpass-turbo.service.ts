import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import maplibregl from "maplibre-gl";
import osmtogeojson from "osmtogeojson";

@Injectable()
export class OverpassTurboService {
    constructor(private readonly httpClient: HttpClient) {}

    public initialize() {
        maplibregl.addProtocol("overpass", (params, callback) => {
            this.getGeoJson(params.url.replace("overpass://", "")).then(geojson => {
                callback(null, geojson, null, null);
            }).catch(error => callback(error));
            return { cancel: () => { } };
        });
    }

    private async getGeoJson(url: string): Promise<GeoJSON.FeatureCollection> {
        let body = decodeURIComponent(url);
        let text = await firstValueFrom(this.httpClient.post("https://overpass-api.de/api/interpreter", body, {responseType: "text"})) as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        return osmtogeojson(xmlDoc);
    }
}