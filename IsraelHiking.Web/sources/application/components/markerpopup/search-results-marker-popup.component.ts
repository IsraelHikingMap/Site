import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";

@Component({
    selector: "search-results-marker-popup",
    templateUrl: "./search-results-marker-popup.component.html"
})
export class SearchResultsMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService, http: Http,
        elevationProvider: ElevationProvider) {
        super(resources, http, elevationProvider)
    }

    public convertToRoute: () => void;
}