import { Component, inject, input, output } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import { GeoJSONSourceComponent, LayerComponent } from "@maplibre/ngx-maplibre-gl";
import { MapLayerMouseEvent } from "maplibre-gl";

@Component({
    selector: "routes-path",
    templateUrl: "./routes-path.component.html",
    imports: [GeoJSONSourceComponent, LayerComponent]
})
export class RoutesPathComponent {
    public routesGeoJson = input<GeoJSON.FeatureCollection>({
        type: "FeatureCollection",
        features: []
    });

    public lineLayerMouseEnter = output<MapLayerMouseEvent>();
    public lineLayerMouseMove = output<MapLayerMouseEvent>();
    public lineLayerMouseLeave = output<MapLayerMouseEvent>();
    public lineLayerClick = output<MapLayerMouseEvent>();
    public pointsLayerClick = output<MapLayerMouseEvent>();


    public resources = inject(ResourcesService);
}