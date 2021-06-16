import { Component } from "@angular/core";
import { MapComponent } from "ngx-maplibre-gl";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html"
})
export class ZoomComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
                private readonly mapComponent: MapComponent) {
        super(resources);
    }

    public zoomIn() {
        this.mapComponent.mapInstance.zoomTo(Math.round(this.mapComponent.mapInstance.getZoom() + 1));
    }

    public zoomOut() {
        this.mapComponent.mapInstance.zoomTo(Math.round(this.mapComponent.mapInstance.getZoom() - 1));
    }
}
