import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osmtogeojson";

@Injectable()
export class OverpassTurboService {
    private static readonly OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

    private readonly httpClient = inject(HttpClient);

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

    public async getLongWay(id: string, name: string, isWaterway: boolean, isMtbRoute: boolean): Promise<GeoJSON.FeatureCollection> {
        const quotedName = name.replace(/"/g, '\\"')
        const query = `
        way(${id});
        complete
        {
          way(around:30)
            [${isWaterway ? 'waterway' : 'highway'}]
            ["${isMtbRoute ? 'mtb:name' : 'name'}"="${quotedName}"];
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
