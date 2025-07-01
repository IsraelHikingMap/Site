import { inject, Injectable } from "@angular/core";
import { StyleSpecification } from "maplibre-gl";

import { FileService } from "./file.service";
import { ResourcesService } from "./resources.service";

@Injectable()
export class DefaultStyleService {
    public style: StyleSpecification;

    private readonly fileService = inject(FileService);
    private readonly resources = inject(ResourcesService);

    constructor() {
        this.style = {
            version: 8,
            sources: {},
            layers: [],
            glyphs: this.fileService.getFullUrl("fonts/glyphs/{fontstack}/{range}.pbf"),
            sprite: this.fileService.getFullUrl("content/sprite/sprite")
        };
    }

    public getStyleWithPlaceholders(): StyleSpecification {
        let styleWithPlaceholder = {...this.style};
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
