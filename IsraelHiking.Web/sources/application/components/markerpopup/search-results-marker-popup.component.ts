import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";

import { ResourcesService } from "../../services/resources.service";
import { PoiService, IPointOfInterestExtended } from "../../services/poi.service";
import { RoutesService } from "../../services/layers/routelayers/routes.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { GeoJsonParser } from "../../services/geojson.parser";
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
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private poiService: PoiService,
        private geoJsonParser: GeoJsonParser,
        private routesService: RoutesService) {
        super(resources, http, applicationRef, elevationProvider);
    }

    public selectRoute = (routeData: Common.RouteData): void => {
        console.log(routeData);
        throw new Error("This function must be assigned by containing layer!");
    };
    public clearSelectedRoute = (): void => { throw new Error("This function must be assigned by the containing layer!") };

    public setIdAndSource(id: string, source: string) {
        this.id = id;
        this.source = source;
        this.poiService.getPoint(this.id, this.source).then((response) => {
            this.poiExtended = response.json() as IPointOfInterestExtended;
            var dataContainer = this.geoJsonParser.toDataContainer(this.poiExtended.featureCollection,
                this.resources.getCurrentLanguageCodeSimplified());
            this.selectRoute(dataContainer.routes[0]);
        });
    }

    public convertToRoute = () => {
        var container = this.geoJsonParser.toDataContainer(this.poiExtended.featureCollection,
            this.resources.getCurrentLanguageCodeSimplified());
        this.routesService.setData([container.routes[0]]);
        this.clearSelectedRoute();
        this.marker.closePopup();
    }
}