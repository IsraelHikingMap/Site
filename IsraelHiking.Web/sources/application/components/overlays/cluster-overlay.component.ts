import { Component, Input } from "@angular/core";
import { Router } from "@angular/router";

import { ResourcesService } from "../../services/resources.service";
import { RouteStrings } from "../../services/hash.service";
import { IPointOfInterest } from "../../services/poi.service";
import { ClosableOverlayComponent } from "./closable-overlay.component";

@Component({
    selector: "cluster-overlay",
    templateUrl: "./cluster-overlay.component.html"
})
export class ClusterOverlayComponent extends ClosableOverlayComponent {

    @Input()
    public points: IPointOfInterest[];

    constructor(resources: ResourcesService,
        private readonly router: Router) {
        super(resources);
    }

    public getRouterLinkForPoint(point: IPointOfInterest) {
        return this.router.createUrlTree([RouteStrings.POI, point.source, point.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } }).toString();
    }
}