import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { ElevationProvider } from "../../services/ElevationProvider";
import { BaseMarkerPopupComponent } from "./BaseMarkerPopupComponent";

@Component({
    selector: "route-marker-popup",
    templateUrl: "./routeMarkerPopup.html"
})
export class RouteMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService, http: Http,
        elevationProvider: ElevationProvider) {
        super(resources, http, elevationProvider)
    }
}