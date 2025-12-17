import { Component, inject, input, output } from "@angular/core";
import { Router } from "@angular/router";
import { Dir } from "@angular/cdk/bidi";
import { NgClass } from "@angular/common";
import { MatButton } from "@angular/material/button";

import { Angulartics2OnModule } from "../../directives/gtag.directive";
import { ResourcesService } from "../../services/resources.service";
import { RouteStrings } from "../../services/hash.service";
import { GeoJSONUtils } from "../../services/geojson-utils";

@Component({
    selector: "cluster-overlay",
    templateUrl: "./cluster-overlay.component.html",
    styleUrls: ["./cluster-overlay.component.scss"],
    imports: [Dir, MatButton, Angulartics2OnModule, NgClass]
})
export class ClusterOverlayComponent {

    public features = input<GeoJSON.Feature[]>();

    public closed = output();
    public readonly resources = inject(ResourcesService);

    private readonly router = inject(Router);

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
