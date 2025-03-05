import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osm2geojson-lite";
import { SpatialService } from "./spatial.service";

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
        const query = `${type}(${id});`;
        return await this.getFeatureFromQuery(query, 6000);
    }

    private async getFeatureFromQuery(query: string, timeoutInMilliseconds = 2000): Promise<GeoJSON.Feature> {
        try {
            
            const json = await firstValueFrom(this.httpClient.post(OverpassTurboService.OVERPASS_API_URL, `[out: json];${query}out geom;`).pipe(timeout(timeoutInMilliseconds))) as unknown;
            const geojson = osmtogeojson(json, {completeFeature: true, excludeWay: false}) as GeoJSON.FeatureCollection;
            if (geojson.features.length === 1 && geojson.features[0].geometry.type !== "MultiLineString") {
                return geojson.features[0];
            }
            if (geojson.features.every(f => f.geometry.type === "LineString")) {
                const geometry = SpatialService.mergeLines(geojson.features.map(f => f.geometry as GeoJSON.LineString));
                geojson.features[0].geometry = geometry;
                return geojson.features[0];
            }
            if (geojson.features.length === 1 && geojson.features[0].geometry.type === "MultiLineString") {
                geojson.features[0].geometry = SpatialService.mergeLines(geojson.features[0].geometry.coordinates.map(l => ({ type: "LineString", coordinates: l})));
                return geojson.features[0];
            }
            return geojson.features[0];
        } catch {
            return null;
        }
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
