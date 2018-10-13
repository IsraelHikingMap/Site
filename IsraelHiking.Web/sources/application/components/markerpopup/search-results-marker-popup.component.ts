import { Component, Input } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";


@Component({
    selector: "search-results-marker-popup",
    templateUrl: "./search-results-marker-popup.component.html"
})
export class SearchResultsMarkerPopupComponent extends BaseMarkerPopupComponent {

    @Input()
    public convertToRoute: () => void;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        elevationProvider: ElevationProvider) {
        super(resources, httpClient, elevationProvider);
    }
}