import { Component } from "@angular/core";
import { Http } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { ElevationProvider } from "../../services/ElevationProvider";
import { BaseMarkerPopupComponent } from "./BaseMarkerPopupComponent";

@Component({
    selector: "search-results-marker-popup",
    moduleId: module.id,
    templateUrl: "searchResultsMarkerPopup.html"
})
export class SearchResultsMarkerPopupComponent extends BaseMarkerPopupComponent {
    constructor(resources: ResourcesService, http: Http,
        elevationProvider: ElevationProvider) {
        super(resources, http, elevationProvider)
    }

    public convertToRoute: () => void;
}