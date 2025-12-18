import { Component, inject } from "@angular/core";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MapComponent } from "@maplibre/ngx-maplibre-gl";

import { Angulartics2OnModule } from "../directives/gtag.directive";
import { ResourcesService } from "../services/resources.service";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html",
    imports: [MatButton, Angulartics2OnModule, MatTooltip]
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
