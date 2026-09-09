import { Component, computed, inject } from "@angular/core";

import { OsmAddressesService } from "../services/osm-addresses.service";
import { RunningContextService } from "../services/running-context.service";
import { ResourcesService } from "../services/resources.service";
import { LayersService } from "../services/layers.service";
import { SATELLITE_MAP } from "../reducers/initial-state";

@Component({
    selector: "osm-attribution",
    templateUrl: "./osm-attribution.component.html",
    imports: []
})
export class OsmAttributionComponent {
    public readonly resources = inject(ResourcesService);
    private readonly osmAddressService = inject(OsmAddressesService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly layersService = inject(LayersService);

    /** The imagery provider requires its attribution to be shown whenever its imagery is on screen */
    public readonly isSatelliteImageryShown = computed(() => this.layersService.selectedBaseLayer().key === SATELLITE_MAP);

    public getEditAddress(): string {
        return this.osmAddressService.osmAddress();
    }

    public isMobile(): boolean {
        return this.runningContextService.isMobile;
    }
}