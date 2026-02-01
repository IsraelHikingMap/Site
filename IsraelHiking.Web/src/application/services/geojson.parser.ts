import { Injectable } from "@angular/core";

import { SpatialService } from "./spatial.service";
import type { LatLngAlt } from "../models";

@Injectable()
export class GeoJsonParser {
    public toRoutes(feature: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>, language?: string): { latlngs: LatLngAlt[]; name: string }[] {
        const name = this.getPropertyValue(feature.properties, "name", language);
        const routes = [];
        if (feature.geometry.type === "LineString") {
            routes.push({ latlngs: feature.geometry.coordinates.map(c => SpatialService.toLatLng(c)), name });
        } else {
            for (let i = 0; i < feature.geometry.coordinates.length; i++) {
                const prefix = i > 0 ? " " + i : "";
                routes.push({ latlngs: feature.geometry.coordinates[i].map(c => SpatialService.toLatLng(c)), name: `${name}${prefix}` });
            }
        }
        return routes;
    }

    private getPropertyValue(properties: Record<string, string>, key: string, language?: string): string {
        let value = "";
        if (language) {
            value = properties[key + ":" + language];
        }
        return value || properties[key];
    }
}
