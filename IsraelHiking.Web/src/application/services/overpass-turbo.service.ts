import { HttpClient } from "@angular/common/http";
import { Injectable } from "@angular/core";
import { firstValueFrom, timeout } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osmtogeojson";

@Injectable()
export class OverpassTurboService {
    private static readonly OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

    constructor(private readonly httpClient: HttpClient) {}

    public initialize() {
        addProtocol("overpass", async (params, _abortController) => {
            const query = decodeURIComponent(params.url.replace("overpass://Q/", "").replace("overpass://", ""));
            const geojson = await this.getGeoJsonFromQuery(query, 20000);
            return {data: geojson};
        });
    }

    private async getGeoJsonFromQuery(query: string, timeoutInMilliseconds = 2000): Promise<GeoJSON.FeatureCollection> {
        try {
            const text = await firstValueFrom(this.httpClient
                .post(OverpassTurboService.OVERPASS_API_URL, query, {responseType: "text"}).pipe(timeout(timeoutInMilliseconds))
            ) as string;
            const parser = new DOMParser();
            const xmlDoc = parser.parseFromString(text, "text/xml");
            return osmtogeojson(xmlDoc);
        } catch {
            return {
                type: "FeatureCollection",
                features: []
            };
        }
    }

    public async getLongWay(id: string, title: string, isWaterway: boolean, isMtbRoute: boolean): Promise<GeoJSON.FeatureCollection> {
        const query = `
        way(${id});
        complete
        {
          way(around:30)
            [${isWaterway ? 'waterway' : 'highway'}]
            ["${isMtbRoute ? 'mtb:name' : 'name'}"="${title}"];
        }
        out geom;`;
        return await this.getGeoJsonFromQuery(query);
    }

    public async getPlaceGeometry(nodeId: string): Promise<GeoJSON.FeatureCollection> {
        const query = `
        node(${nodeId});

        node._ -> .p;
        .p is_in;
        area._[place]
        (if: t["name"] == p.u(t["name"]))
        (if: t["place"] == p.u(t["place"]))
        ;
        wr(pivot);
        out geom;`
        return await this.getGeoJsonFromQuery(query);
    }
}
