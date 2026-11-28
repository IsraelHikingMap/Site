import { Component, computed, inject, input, output } from "@angular/core";
import { Router } from "@angular/router";
import { NgClass } from "@angular/common";
import { MatCard } from "@angular/material/card";
import { MatIconButton } from "@angular/material/button";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { AnimationOptions, LottieComponent } from "ngx-lottie";

import { AnalyticsDirective } from "../directives/analytics.directive";
import { ImageAttributionComponent } from "./image-attribution.component";
import { DescriptionComponent } from "./description.component";
import { PublicRouteDetailsComponent } from "./public-route-details.component";
import { ResourcesService } from "../services/resources.service";
import { PoiService } from "../services/poi.service";
import { RunningContextService } from "../services/running-context.service";
import { GeoJSONUtils } from "../services/geojson-utils";
import { PoiProperties } from "../services/osm-tags.service";
import { RouteStrings } from "../services/hash.service";

/**
 * The animation shown for a route with no image. It is anchored to the top when cropped, as the sky
 * and the birds are what makes it recognizable.
 */
export const LOTTIE_SCENERY: AnimationOptions = {
    path: "content/lottie/placeholder-scenery.json",
    rendererSettings: { preserveAspectRatio: "xMidYMin slice" }
};

/** A route in the list of the find routes screen, with its image, details, description and actions */
@Component({
    selector: "public-route-card",
    templateUrl: "./public-route-card.component.html",
    imports: [NgClass, MatCard, MatIconButton, MatMenu, MatMenuItem, MatMenuTrigger, CdkCopyToClipboard, LottieComponent,
        AnalyticsDirective, ImageAttributionComponent, DescriptionComponent, PublicRouteDetailsComponent],
    host: { "[id]": "'route-' + route().properties.poiId", class: "block" }
})
export class PublicRouteCardComponent {
    public readonly route = input.required<GeoJSON.Feature<GeoJSON.Point, PoiProperties>>();
    public readonly selected = input(false);

    public readonly moveTo = output();
    public readonly convertToRoute = output();

    public readonly lottieScenery = LOTTIE_SCENERY;
    public readonly resources = inject(ResourcesService);

    public readonly title = computed(() =>
        GeoJSONUtils.getTitle(this.route(), this.resources.getCurrentLanguageCodeSimplified()));
    public readonly isFromOsm = computed(() => this.route().properties.poiSource === "OSM");
    public readonly poiLink = computed(() => this.poiService.getPoiSocialLinks(this.route()).poiLink);

    private readonly router = inject(Router);
    private readonly poiService = inject(PoiService);
    private readonly runningContextService = inject(RunningContextService);

    public readonly isApp = this.runningContextService.isCapacitor;

    public navigateToPoi() {
        this.router.navigate([RouteStrings.ROUTE_POI, this.route().properties.poiSource, this.route().properties.identifier]);
    }

    public navigateToEditPoi() {
        this.router.navigate([RouteStrings.ROUTE_POI, this.route().properties.poiSource, this.route().properties.identifier],
            { queryParams: { edit: true } });
    }
}
