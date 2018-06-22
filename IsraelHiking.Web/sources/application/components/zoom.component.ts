import { Component } from "@angular/core";
import { BaseMapComponent } from "./base-map.component";
import { MapService } from "../services/map.service";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html"
})
export class ZoomComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
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