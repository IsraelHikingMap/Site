import { HttpClient } from "@angular/common/http";
import { inject, Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osmtogeojson";

@Injectable()
export class OverpassTurboService {

    private readonly httpClient = inject(HttpClient);

    public initialize() {
        addProtocol("overpass", async (params, _abortController) => {
            const geojson = await this.getGeoJson(params.url.replace("overpass://Q/", "").replace("overpass://", ""));
            return {data: geojson};
        });
    }

    private async getGeoJson(url: string): Promise<GeoJSON.FeatureCollection> {
        const body = decodeURIComponent(url);
        const text = await firstValueFrom(this.httpClient
            .post("https://overpass-api.de/api/interpreter", body, {responseType: "text"})
        ) as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        return osmtogeojson(xmlDoc);
    }
}
