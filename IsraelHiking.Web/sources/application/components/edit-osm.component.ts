import { Component } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { ResourcesService } from "../services/resources.service";
import { LayersService } from "../services/layers/layers.service";
import { AuthorizationService } from "../services/authorization.service";
import { BaseMapComponent } from "./base-map.component";
import { HashService } from "../services/hash.service";
import { ApplicationState } from "../models/models";


@Component({
    selector: "edit-osm",
    templateUrl: "./edit-osm.component.html"
})
export class EditOSMComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.configuration.isAdvanced)
    public isAdvanced: Observable<boolean>;

    constructor(resources: ResourcesService,
        private readonly layersService: LayersService,
        private readonly authorizationService: AuthorizationService,
        private readonly hashService: HashService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public getOsmAddress() {
        let poiRouterData = this.hashService.getPoiRouterData();
        let baseLayerAddress = this.layersService.getSelectedBaseLayer().address;
        if (poiRouterData != null && poiRouterData.source.toLocaleLowerCase() === "osm") {

            return this.authorizationService.getEditElementOsmAddress(baseLayerAddress, poiRouterData.id);
        }
        let currentLocation = this.ngRedux.getState().location;
        return this.authorizationService.getEditOsmLocationAddress(baseLayerAddress,
            currentLocation.zoom,
            currentLocation.latitude,
            currentLocation.longitude);
    }
}