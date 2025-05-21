import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osm2geojson-lite";
import { SpatialService } from "./spatial.service";
import { Urls } from "application/urls";

@Injectable()
export class OverpassTurboService {
    private static readonly OVERPASS_API_URL = "https://overpass-api.de/api/interpreter";

    private readonly httpClient = inject(HttpClient);

    public initialize() {
        addProtocol("overpass", async (params, _abortController) => {
            const query = decodeURIComponent(params.url.replace("overpass://Q/", "").replace("overpass://", ""));
            const geojson = await this.getFeatureFromQuery(query, 20000);
            return {data: geojson};
        });
    }

    public async getFeature(type: string, id: string): Promise<GeoJSON.Feature> {
        const address = Urls.osmApi + type + "/" + id + (type !== "node" ? "/full" : "") + ".json";
        const content = await firstValueFrom(this.httpClient.get(address).pipe(timeout(6000))) as unknown;
        return this.processFeature(content);
    }

    private async getFeatureFromQuery(query: string, timeoutInMilliseconds = 2000): Promise<GeoJSON.Feature> {
        try {
            const json = await firstValueFrom(this.httpClient.post(OverpassTurboService.OVERPASS_API_URL, `[out: json];${query}out geom;`).pipe(timeout(timeoutInMilliseconds))) as unknown;
            return this.processFeature(json);
        } catch {
            return null;
        }
    }

    private processFeature(content: Parameters<typeof osmtogeojson>[0]): GeoJSON.Feature {
        const geojson = osmtogeojson(content, {completeFeature: true, excludeWay: false}) as GeoJSON.FeatureCollection;
        if (geojson.features.length === 1 && geojson.features[0].geometry.type !== "MultiLineString") {
            return geojson.features[0];
        }
        if (geojson.features.length === 1 && geojson.features[0].geometry.type === "MultiLineString") {
            geojson.features[0].geometry = SpatialService.mergeLines(geojson.features[0].geometry.coordinates.map(l => ({ type: "LineString", coordinates: l})));
            return geojson.features[0];
        }
        let hasPolygon = false;
        const allLines = geojson.features.reduce((acc, f) => {
            if (f.geometry.type === "MultiLineString") {
                acc.push(...f.geometry.coordinates);
            } else if (f.geometry.type === "LineString") {
                acc.push(f.geometry.coordinates);
            } else if (f.geometry.type === "Polygon") {
                hasPolygon = true;
            }
            return acc;
        }, [] as GeoJSON.Position[][]);
        if (allLines.length === 0 || hasPolygon) {
            return geojson.features[0];
        }
        geojson.features[0].geometry = SpatialService.mergeLines(allLines.map(l => ({ type: "LineString", coordinates: l})));
        return geojson.features[0];
    }

    public async getLongWay(id: string, name: string, isWaterway: boolean, isMtbRoute: boolean): Promise<GeoJSON.Feature> {
        const quotedName = name.replace(/"/g, "\\\"")
        const query = `
        way(${id});
        complete
        {
          way(around:30)
            [${isWaterway ? "waterway" : "highway"}]
            ["${isMtbRoute ? "mtb:name" : "name"}"="${quotedName}"];
        }`;
        return await this.getFeatureFromQuery(query);
    }

    public async getPlaceGeometry(nodeId: string): Promise<GeoJSON.Feature> {
        const query = `
        node(${nodeId});

        node._ -> .p;
        .p is_in;
        area._[place]
        (if: t["name"] == p.u(t["name"]))
        (if: t["place"] == p.u(t["place"]))
        ;
        wr(pivot);`
        return await this.getFeatureFromQuery(query);
    }
}
