import { inject, Injectable } from "@angular/core";
import { StyleSpecification } from "maplibre-gl";

import { MapService } from "./map.service";
import { ResourcesService } from "./resources.service";

@Injectable()
export class DefaultStyleService {
    public style: StyleSpecification;

    private readonly mapService = inject(MapService);
    private readonly resources = inject(ResourcesService);

    constructor() {
        this.style = {
            version: 8,
            sources: {},
            layers: [],
            glyphs: "{fontstack}/{range}.pbf", // to please maplibre
            sprite: this.mapService.getFullUrl("content/sprite/sprite")
        };
    }

    public getStyleWithPlaceholders(): StyleSpecification {
        const styleWithPlaceholder = { ...this.style };
        styleWithPlaceholder.sources = {
            dummy: {
                type: "geojson",
                data: {
                    type: "Feature",
                    properties: {},
                    geometry: {
                        type: "Point",
                        coordinates: [0, 0]
                    }
                }
            }
        };
        styleWithPlaceholder.layers = [
            {
                id: this.resources.endOfBaseLayer,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfOverlays,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfClusters,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            },
            {
                id: this.resources.endOfRoutes,
                type: "circle",
                source: "dummy",
                layout: { visibility: "none" }
            }
        ];
        return styleWithPlaceholder;
    }
}
