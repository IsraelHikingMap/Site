import { Injectable } from "@angular/core";
import { Style } from "mapbox-gl";

@Injectable()
export class DefaultStyleService {
    public style: Style;

    constructor() {
        this.style = {
            version: 8,
            sources: {},
            layers: [],
            glyphs: "https://israelhiking.osm.org.il/glyphs/{fontstack}/{range}.pbf",
            sprite: ""
        };
    }
}
