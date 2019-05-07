import { Injectable } from "@angular/core";
import { Style } from "mapbox-gl";

import { FileService } from "./file.service";

@Injectable()
export class DefaultStyleService {
    public style: Style;

    constructor(private readonly fileService: FileService) {
        this.style = {
        version: 8,
            sources: {},
            layers: [],
            // glyphs: "https://orangemug.github.io/font-glyphs/glyphs/{fontstack}/{range}.pbf",
            // sprite: "https://israelhikingmap.github.io/VectorMap/Icons/publish/sprite"
            glyphs: this.fileService.getFullFilePath("fonts/glyphs/{fontstack}/{range}.pbf"),
            sprite: this.fileService.getFullFilePath("content/sprite/sprite")
        };
    }
}