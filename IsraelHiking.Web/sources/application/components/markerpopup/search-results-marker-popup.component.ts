import { Component, ApplicationRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import * as Common from "../../common/IsraelHiking";


@Component({
    selector: "search-results-marker-popup",
    templateUrl: "./search-results-marker-popup.component.html"
})
export class SearchResultsMarkerPopupComponent extends BaseMarkerPopupComponent {

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider) {
        super(resources, httpClient, applicationRef, elevationProvider);
    }

    public selectRoute = (routeData: Common.RouteData): void => {
        throw new Error(`This function must be assigned by containing layer! Route: ${routeData.name}`);
    };
    public convertToRoute = (): void => { throw new Error("This function must be assigned by the containing layer!") };
}