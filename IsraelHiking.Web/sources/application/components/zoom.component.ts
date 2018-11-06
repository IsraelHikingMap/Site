import { Component } from "@angular/core";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { MapService } from "../services/map.service";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html"
})
export class ZoomComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private readonly mapService: MapService) {
        super(resources);
    }
    public zoomIn() {
        this.mapService.map.getView().animate({
            zoom: Math.round(this.mapService.map.getView().getZoom()) + 1,
            duration: 250
        });
    }

    public zoomOut() {
        this.mapService.map.getView().animate({
            zoom: Math.round(this.mapService.map.getView().getZoom()) - 1,
            duration: 250
        });
    }
}