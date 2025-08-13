import { Injectable } from "@angular/core";

import { SpatialService } from "./spatial.service";
import type { LatLngAlt, MarkerData } from "../models";

@Injectable()
export class GeoJsonParser {
    public toMarkerData(feature: GeoJSON.Feature<GeoJSON.Point>, language?: string): MarkerData {
        const id = feature.properties.identifier;
        const icon = feature.properties.icon;
        const website = feature.properties.website;
        const image = feature.properties.image;
        const point = feature.geometry as GeoJSON.Point;
        const name = this.getPropertyValue(feature.properties, "name", language);
        const description = this.getPropertyValue(feature.properties, "description", language);
        const marker = this.createMarker(point.coordinates, id, name, icon, description);
        if (website) {
            marker.urls.push({ mimeType: "text/html", text: marker.title, url: website });
        }
        if (image) {
            marker.urls.push({
                mimeType: `image/${image.split(".").pop()}`,
                text: "",
                url: image
            });
        }
        return marker;
    }

    public toRoutes(feature: GeoJSON.Feature<GeoJSON.LineString | GeoJSON.MultiLineString>, language?: string):
        {latlngs: LatLngAlt[]; name: string}[] {
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

    private createMarker(coordinates: GeoJSON.Position, id: string, message: string, icon: string, description: string): MarkerData {
        return {
            id,
            latlng: SpatialService.toLatLng(coordinates),
            title: message,
            type: icon ? icon.replace("icon-", "") : "",
            description,
            urls: []
        };
    }
}
