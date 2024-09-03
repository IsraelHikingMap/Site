import { Component, Input, Output, EventEmitter } from "@angular/core";
import { Router } from "@angular/router";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RouteStrings } from "../../services/hash.service";
import { GeoJSONUtils } from "../../services/geojson-utils";

@Component({
    selector: "cluster-overlay",
    templateUrl: "./cluster-overlay.component.html",
    styleUrls: ["./cluster-overlay.component.scss"]
})
export class ClusterOverlayComponent extends BaseMapComponent {

    @Input()
    public features: GeoJSON.Feature[];

    @Output()
    public closed: EventEmitter<void>;

    constructor(resources: ResourcesService,
                private readonly router: Router) {
        super(resources);
        this.closed = new EventEmitter();
    }

    public getTitle(feature: GeoJSON.Feature) {
        return GeoJSONUtils.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hasExtraData(feature: GeoJSON.Feature): boolean {
        return GeoJSONUtils.hasExtraData(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public clickOnItem(feature: GeoJSON.Feature) {
        this.closed.emit();
        this.router.navigate([RouteStrings.POI, feature.properties.poiSource, feature.properties.identifier],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }
}
