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
        let baseLayerAddress = this.getBaseLayerAddress();
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

    private getBaseLayerAddress() {
        let baseLayerAddress = this.layersService.getSelectedBaseLayer().address;
        if (baseLayerAddress.indexOf("{x}") !== -1) {
            return baseLayerAddress;
        }
        let defaultAddress = Urls.baseTilesAddress + "/Hebrew/tiles/{z}/{x}/{y}.png";
        // using the same logic that the server is using in ImageCreationService + language
        if (!baseLayerAddress) {
            return defaultAddress;
        }
        let language = this.resources.currentLanguage.code === "he" ? "Hebrew" : "English";
        let tiles = "tiles";
        if (baseLayerAddress.endsWith(".json")) {
            let styleKey = baseLayerAddress.replace(".json", "").split("/").splice(-1)[0];
            if (styleKey === "ilMTB") {
                tiles = "mtbtiles";
            }
        }
        return `${Urls.baseTilesAddress}/${language}/${tiles}/{z}/{x}/{y}.png`;
    }
}
