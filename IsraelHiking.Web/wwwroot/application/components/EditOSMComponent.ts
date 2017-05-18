import { Component } from "@angular/core";
import { ResourcesService } from "../services/ResourcesService";
import { MapService } from "../services/MapService";
import { LayersService } from "../services/layers/LayersService";
import { OsmUserService } from "../services/OsmUserService";
import { BaseMapComponent } from "./BaseMapComponent"; 

@Component({
    selector: "edit-osm",
    templateUrl: "application/components/editOSM.html"
})
export class EditOSMComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private mapService: MapService,
        private layersService: LayersService,
        private osmUserService: OsmUserService) {
        super(resources);
    }

    public editOsm = (e: Event) => {
        let center = this.mapService.map.getCenter();
        let zoom = this.mapService.map.getZoom();
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        window.open(this.osmUserService.getEditOsmLocationAddress(baseLayerAddress, zoom, center));
        this.suppressEvents(e);
    };
}