import { Component } from "@angular/core";
import { MapComponent } from "ngx-mapbox-gl";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html"
})
export class ZoomComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
                private readonly host: MapComponent) {
        super(resources);
    }

    public zoomIn() {
        this.host.mapInstance.zoomTo(Math.round(this.host.mapInstance.getZoom() + 1));
    }

    public zoomOut() {
        this.host.mapInstance.zoomTo(Math.round(this.host.mapInstance.getZoom() - 1));
    }
}
