import { Component, inject } from "@angular/core";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html"
})
export class ZoomComponent {
    public readonly resources = inject(ResourcesService);
    private readonly mapComponent = inject(MapComponent);

    public zoomIn() {
        this.mapComponent.mapInstance.zoomTo(Math.round(this.mapComponent.mapInstance.getZoom() + 1));
    }

    public zoomOut() {
        this.mapComponent.mapInstance.zoomTo(Math.round(this.mapComponent.mapInstance.getZoom() - 1));
    }
}
