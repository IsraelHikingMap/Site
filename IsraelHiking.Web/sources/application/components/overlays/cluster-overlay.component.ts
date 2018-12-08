import { Component, Input } from "@angular/core";

import { ResourcesService } from "../../services/resources.service";
import { RouteStrings } from "../../services/hash.service";
import { ClosableOverlayComponent } from "./closable-overlay.component";
import { PointOfInterest } from "../../models/models";

@Component({
    selector: "cluster-overlay",
    templateUrl: "./cluster-overlay.component.html"
})
export class ClusterOverlayComponent extends ClosableOverlayComponent {

    @Input()
    public points: PointOfInterest[];

    constructor(resources: ResourcesService) {
        super(resources);
    }

    public getRouterLinkForPoint(point: PointOfInterest) {
        return [RouteStrings.POI, point.source, point.id];
    }
}