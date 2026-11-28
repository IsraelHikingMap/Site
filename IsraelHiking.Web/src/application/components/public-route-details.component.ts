import { Component, computed, inject, input } from "@angular/core";

import { DistancePipe } from "../pipes/distance.pipe";
import { ResourcesService } from "../services/resources.service";
import { PoiProperties } from "../services/osm-tags.service";

/** The difficulty, kind and length of a public route, shown under its title */
@Component({
    selector: "public-route-details",
    templateUrl: "./public-route-details.component.html",
    imports: [DistancePipe]
})
export class PublicRouteDetailsComponent {
    public readonly route = input.required<GeoJSON.Feature<GeoJSON.Point, PoiProperties>>();

    public readonly categoryIcon = computed(() => {
        switch (this.route().properties.poiCategory) {
            case "Hiking":
                return "icon-hike";
            case "Bicycle":
                return "icon-bike";
            case "4x4":
                return "icon-four-by-four";
            default:
                return "icon-question";
        }
    });

    public readonly resources = inject(ResourcesService);
}
