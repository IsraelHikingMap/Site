import { Component } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../services/resources.service";
import { LayersService } from "../services/layers/layers.service";
import { AuthorizationService } from "../services/authorization.service";
import { RunningContextService } from "../services/running-context.service";
import { BaseMapComponent } from "./base-map.component";
import { ApplicationState } from "../models/models";
import { Urls } from "../urls";

@Component({
    selector: "edit-osm",
    templateUrl: "./edit-osm.component.html"
})
export class EditOSMComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
                private readonly layersService: LayersService,
                private readonly authorizationService: AuthorizationService,
                private readonly runningContextService: RunningContextService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    public isShowButton() {
        return !this.runningContextService.isCordova &&
            !this.runningContextService.isMobile &&
            !this.runningContextService.isIFrame;
    }

    public getOsmAddress() {
        let poiState = this.ngRedux.getState().poiState;
        let baseLayerAddress = this.layersService.getSelectedBaseLayer().address;
        if (baseLayerAddress.indexOf("{x}") === -1) {
            // using the same logic that the server is using in ImageCreationService
            baseLayerAddress = Urls.baseTilesAddress + "/Hebrew/tiles/{z}/{x}/{y}.png";
        }
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
