import { Component, Input, Output, EventEmitter } from "@angular/core";
import { Router } from "@angular/router";

import { BaseMapComponent } from "../base-map.component";
import { ResourcesService } from "../../services/resources.service";
import { RouteStrings } from "../../services/hash.service";
import { IPointOfInterest } from "../../services/poi.service";
import { LatLngAlt } from "../../models/models";

@Component({
    selector: "cluster-overlay",
    templateUrl: "./cluster-overlay.component.html"
})
export class ClusterOverlayComponent extends BaseMapComponent {

    @Input()
    public isOpen: Boolean;

    @Input()
    public latlng: LatLngAlt;

    @Output()
    public closed: EventEmitter<any>;

    @Input()
    public points: IPointOfInterest[];

    constructor(resources: ResourcesService,
        private readonly router: Router) {
        super(resources);
        this.onClose = new EventEmitter();
    }

    public getRouterLinkForPoint(point: IPointOfInterest) {
        return this.router.createUrlTree([RouteStrings.POI, point.source, point.id],
            { queryParams: { language: this.resources.getCurrentLanguageCodeSimplified() } }).toString();
    }

    public close() {
        this.isOpen = false;
        this.onClose.emit();
    }
}