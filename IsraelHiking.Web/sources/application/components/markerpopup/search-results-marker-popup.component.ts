import { Component, ApplicationRef } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { ResourcesService } from "../../services/resources.service";
import { PoiService, IPointOfInterestExtended } from "../../services/poi.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { MapService } from "../../services/map.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import * as Common from "../../common/IsraelHiking";


@Component({
    selector: "search-results-marker-popup",
    templateUrl: "./search-results-marker-popup.component.html"
})
export class SearchResultsMarkerPopupComponent extends BaseMarkerPopupComponent {
    public id: string;
    public source: string;

    private poiExtended: IPointOfInterestExtended;

    constructor(resources: ResourcesService,
        httpClient: HttpClient,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private poiService: PoiService,
        private routesService: RoutesService,
        private mapService: MapService) {
        super(resources, httpClient, applicationRef, elevationProvider);
    }

    public selectRoute = (routeData: Common.RouteData): void => {
        throw new Error(`This function must be assigned by containing layer! Route: ${routeData.name}`);
    };
    public convertToRoute = (): void => { throw new Error("This function must be assigned by the containing layer!") };

    public setIdSourceAndType(id: string, source: string) {
        this.id = id;
        this.source = source;
        this.poiService.getPoint(this.id, this.source).then((poiExtended) => {
            this.poiExtended = poiExtended;
            this.mapService.routesJsonToRoutesObject(this.poiExtended.dataContainer.routes);
            this.selectRoute(this.poiExtended.dataContainer.routes[0]);
        });
    }
}