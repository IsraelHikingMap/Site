import { Component, Input, inject, output } from "@angular/core";
import { Router } from "@angular/router";

import { ResourcesService } from "../../services/resources.service";
import { PoiService } from "../../services/poi.service";
import { RouteStrings } from "../../services/hash.service";

@Component({
    selector: "cluster-overlay",
    templateUrl: "./cluster-overlay.component.html",
    styleUrls: ["./cluster-overlay.component.scss"]
})
export class ClusterOverlayComponent {

    @Input()
    public features: GeoJSON.Feature[];

    public closed = output();
    public readonly resources = inject(ResourcesService);

    private readonly router = inject(Router);
    private readonly poiService = inject(PoiService);

    public getTitle(feature: GeoJSON.Feature) {
        return this.poiService.getTitle(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public hasExtraData(feature: GeoJSON.Feature): boolean {
        return this.poiService.hasExtraData(feature, this.resources.getCurrentLanguageCodeSimplified());
    }

    public clickOnItem(feature: GeoJSON.Feature) {
        this.closed.emit();
        this.router.navigate([RouteStrings.POI, feature.properties.poiSource, feature.properties.identifier],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } });
    }
}
