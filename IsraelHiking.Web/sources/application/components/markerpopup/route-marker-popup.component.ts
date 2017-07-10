import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";

@Component({
    selector: "route-marker-popup",
    templateUrl: "./route-marker-popup.component.html"
})
export class RouteMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService, http: Http,
        elevationProvider: ElevationProvider) {
        super(resources, http, elevationProvider);
    }
}