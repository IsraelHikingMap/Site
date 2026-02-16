import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom, timeout } from "rxjs";
import { addProtocol } from "maplibre-gl";
import osmtogeojson from "osm2geojson-lite";

import { SpatialService } from "./spatial.service";
import { Urls } from "../urls";
import type { LatLngAltTime } from "../models";

type OsmResponse = {
    elements: { type: string, id: string }[];
}


@Injectable()
export class OverpassTurboService {

    private readonly httpClient = inject(HttpClient);

    public initialize() {
        addProtocol("overpass", async (params, _abortController) => {
            let url = params.url;
            if (url.startsWith("overpass://s/")) {
                const unshortenAddress = Urls.baseAddress + "/unshorten/overpass-turbo.eu/s/" + url.replace("overpass://s/", "");
                const overpassUrl = await firstValueFrom(this.httpClient.get(unshortenAddress, { responseType: "text" }));
                url = overpassUrl.trim().replace("https://overpass-turbo.eu/?Q=", "");
            }
            let query = decodeURIComponent(url.replace("overpass://Q/", "").replace("overpass://", ""));
            if (!query.startsWith("[out: ")) {
                query = `[out: json];${query}`;
            }
            if (!query.match(/out.*geom;/)) {
                query += "out geom;";
            }
            const content = await firstValueFrom(this.httpClient.post<string | Record<string, any>>(Urls.overpassApi, query).pipe(timeout(20000)));
            const geojson = osmtogeojson(content, { completeFeature: true, excludeWay: false }) as GeoJSON.FeatureCollection;
            return { data: geojson };
        });
    }

    public async getFeature(type: string, id: string): Promise<GeoJSON.Feature> {
        const address = Urls.osmApi + type + "/" + id + (type !== "node" ? "/full" : "") + ".json";
        const content = await firstValueFrom(this.httpClient.get<OsmResponse>(address).pipe(timeout(6000)));
        if (type === "relation") {
            await this.handleNestedRelations(id, content, new Set<string>());
        }
        return this.processFeature(content);
    }

    /**
     * This method does a deep recursion to get all nested relations
     * @param id the id of the relation
     * @param content the content of the relation from OSM API
     * @param visited a set of already visited relations to avoid loops
     * @returns it doesn't return anything, it just updates the content object with all nested relations
     */
    private async handleNestedRelations(id: string, content: OsmResponse, visited: Set<string>): Promise<void> {
        if (visited.has(id)) {
            return;
        }
        visited.add(id);
        const nestedRelations = content.elements.filter(e => e.type === "relation" && e.id.toString() !== id.toString());
        if (nestedRelations.length === 0) {
            return;
        }
        for (const relation of nestedRelations) {
            const nestedContent = await firstValueFrom(this.httpClient.get<OsmResponse>(Urls.osmApi + "relation/" + relation.id + "/full.json").pipe(timeout(6000)));
            await this.handleNestedRelations(relation.id, nestedContent, visited);
            content.elements.push(...nestedContent.elements);
        }
    }

    private async getFeatureFromQuery(query: string, timeoutInMilliseconds = 2000): Promise<GeoJSON.Feature> {
        try {
            const json = await firstValueFrom(this.httpClient.post<Record<string, any>>(Urls.overpassApi, `[out: json];${query}out geom;`).pipe(timeout(timeoutInMilliseconds)));
            return this.processFeature(json);
        } catch {
            return null;
        }
    }

    private processFeature(content: Record<string, any>): GeoJSON.Feature {
        const geojson = osmtogeojson(content, { completeFeature: true, excludeWay: false });
        if (geojson.features.length === 1 && geojson.features[0].geometry.type !== "MultiLineString") {
            return geojson.features[0];
        }
        if (geojson.features.length === 1 && geojson.features[0].geometry.type === "MultiLineString") {
            geojson.features[0].geometry = SpatialService.mergeLines(geojson.features[0].geometry.coordinates.map(l => ({ type: "LineString", coordinates: l })));
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
        geojson.features[0].geometry = SpatialService.mergeLines(allLines.map(l => ({ type: "LineString", coordinates: l })));
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

    public async getPointsInArea(latLng: LatLngAltTime): Promise<GeoJSON.FeatureCollection<GeoJSON.Point>> {
        const distanceInDegrees = 0.00045; // about 50 meters
        const query = `
        [out:json];
        node(${latLng.lat - distanceInDegrees}, ${latLng.lng - distanceInDegrees}, ${latLng.lat + distanceInDegrees}, ${latLng.lng + distanceInDegrees})(if:count_tags() > 0);
        out geom qt;
        `;
        const json = await firstValueFrom(this.httpClient.post<Record<string, any>>(Urls.overpassApi, query).pipe(timeout(3000)));
        return osmtogeojson(json, { completeFeature: true, excludeWay: false }) as GeoJSON.FeatureCollection<GeoJSON.Point>;
    }
}
