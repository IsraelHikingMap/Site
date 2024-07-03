import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osmtogeojson";

@Injectable()
export class OverpassTurboService {
    private static readonly OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

    constructor(private readonly httpClient: HttpClient) {}

    public initialize() {
        addProtocol("overpass", async (params, _abortController) => {
            const geojson = await this.getGeoJson(params.url.replace("overpass://Q/", "").replace("overpass://", ""));
            return {data: geojson};
        });
    }

    private async getGeoJson(url: string): Promise<GeoJSON.FeatureCollection> {
        const body = decodeURIComponent(url);
        const text = await firstValueFrom(this.httpClient
            .post(OverpassTurboService.OVERPASS_API_URL, body, {responseType: "text"})
        ) as string;
        const parser = new DOMParser();
        const xmlDoc = parser.parseFromString(text, "text/xml");
        return osmtogeojson(xmlDoc);
    }

    public async getLongWay(id: string, title: string, isWaterway: boolean, isMtbRoute: boolean): Promise<GeoJSON.FeatureCollection> {
        const query = `
        way(${id});
        complete
        {
          way(around:0)
            [${isWaterway ? 'waterway' : 'highway'}]
            ["${isMtbRoute ? 'mtb:name' : 'name'}"="${title}"];
        }
        out geom;`;
        return await this.getGeoJson(encodeURIComponent(query));
    }
}
