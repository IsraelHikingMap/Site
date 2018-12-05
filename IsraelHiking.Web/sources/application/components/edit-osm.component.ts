import { Component } from "@angular/core";
import { select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { ResourcesService } from "../services/resources.service";
import { LayersService } from "../services/layers/layers.service";
import { AuthorizationService } from "../services/authorization.service";
import { BaseMapComponent } from "./base-map.component";
import { HashService } from "../services/hash.service";
import { ApplicationState, Location } from "../models/models";

@Component({
    selector: "edit-osm",
    templateUrl: "./edit-osm.component.html"
})
export class EditOSMComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.location)
    private location: Observable<Location>;
    private currentLocation: Location;

    constructor(resources: ResourcesService,
        private readonly layersService: LayersService,
        private readonly authorizationService: AuthorizationService,
        private readonly hashService: HashService) {
        super(resources);

        this.location.subscribe(s => this.currentLocation = s);
    }

    public getOsmAddress() {
        let poiRouterData = this.hashService.getPoiRouterData();
        let baseLayerAddress = this.layersService.getSelectedBaseLayer().address;
        if (poiRouterData != null && poiRouterData.source.toLocaleLowerCase() === "osm") {

            return this.authorizationService.getEditElementOsmAddress(baseLayerAddress, poiRouterData.id);
        }
        return this.authorizationService.getEditOsmLocationAddress(baseLayerAddress,
            this.currentLocation.zoom,
            this.currentLocation.latitude,
            this.currentLocation.longitude);
    }
}