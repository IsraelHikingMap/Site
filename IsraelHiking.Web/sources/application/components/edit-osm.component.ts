import { Component } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";

import { ResourcesService } from "../services/resources.service";
import { LayersService } from "../services/layers/layers.service";
import { AuthorizationService } from "../services/authorization.service";
import { BaseMapComponent } from "./base-map.component";
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
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public getOsmAddress() {
        let poiState = this.ngRedux.getState().poiState;
        let baseLayerAddress = this.layersService.getSelectedBaseLayer().address;
        if (poiState.isSidebarOpen &&
            poiState.selectedPointOfInterest != null &&
            poiState.selectedPointOfInterest.source.toLocaleLowerCase() === "osm") {
            return this.authorizationService.getEditElementOsmAddress(baseLayerAddress, poiState.selectedPointOfInterest.id);
        }
        let currentLocation = this.ngRedux.getState().location;
        return this.authorizationService.getEditOsmLocationAddress(baseLayerAddress,
            currentLocation.zoom + 1,
            currentLocation.latitude,
            currentLocation.longitude);
    }
}
