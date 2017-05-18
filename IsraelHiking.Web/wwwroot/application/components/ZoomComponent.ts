import { Component } from "@angular/core";
import { BaseMapComponent } from "./BaseMapComponent"
import { MapService } from "../services/MapService";
import { ResourcesService } from "../services/ResourcesService";

@Component({
    selector: "zoom-control",
    templateUrl: "application/components/zoom.html"
})

export class ZoomComponent extends BaseMapComponent {
    constructor(public resources: ResourcesService,
        private mapService: MapService) {
        super(resources);
    }
    public zoomIn(e: Event) {
        this.mapService.map.zoomIn();
        this.suppressEvents(e);
    }

    public zoomOut(e: Event) {
        this.mapService.map.zoomOut();
        this.suppressEvents(e);
    }
}