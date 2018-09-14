import { Component } from "@angular/core";
import { ResourcesService } from "../services/resources.service";
import { MapService } from "../services/map.service";
import { LayersService } from "../services/layers/layers.service";
import { OsmUserService } from "../services/osm-user.service";
import { BaseMapComponent } from "./base-map.component";
import { HashService } from "../services/hash.service";

@Component({
    selector: "edit-osm",
    templateUrl: "./edit-osm.component.html"
})
export class EditOSMComponent extends BaseMapComponent {

    constructor(resources: ResourcesService,
        private readonly mapService: MapService,
        private readonly layersService: LayersService,
        private readonly osmUserService: OsmUserService,
        private readonly hashService: HashService) {
        super(resources);
    }

    public getOsmAddress() {
        let poiRouterData = this.hashService.getPoiRouterData();
        let baseLayerAddress = this.layersService.selectedBaseLayer.address;
        if (poiRouterData != null && poiRouterData.source.toLocaleLowerCase() === "osm") {
            
            return this.osmUserService.getEditElementOsmAddress(baseLayerAddress, poiRouterData.id);
        }
        let center = this.mapService.map.getCenter();
        let zoom = this.mapService.map.getZoom();
        return this.osmUserService.getEditOsmLocationAddress(baseLayerAddress, zoom, center);
    }
}