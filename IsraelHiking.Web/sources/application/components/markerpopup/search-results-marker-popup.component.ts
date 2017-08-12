import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";

@Component({
    selector: "search-results-marker-popup",
    templateUrl: "./search-results-marker-popup.component.html"
})
export class SearchResultsMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider) {
        super(resources, http, applicationRef, elevationProvider);
    }

    public convertToRoute: () => void;
}