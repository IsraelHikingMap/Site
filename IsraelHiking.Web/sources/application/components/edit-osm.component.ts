import { Component } from "@angular/core";
import { ResourcesService } from "../services/resources.service";
import { MapService } from "../services/map.service";
import { LayersService } from "../services/layers/layers.service";
import { OsmUserService } from "../services/osm-user.service";
import { BaseMapComponent } from "./base-map.component"; 

@Component({
    selector: "edit-osm",
    templateUrl: "./edit-osm.component.html"
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