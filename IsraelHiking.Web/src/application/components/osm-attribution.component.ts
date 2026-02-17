import { Component, inject } from "@angular/core";

import { OsmAddressesService } from "../services/osm-addresses.service";
import { RunningContextService } from "../services/running-context.service";

@Component({
    selector: "osm-attribution",
    templateUrl: "./osm-attribution.component.html",
    styleUrls: ["./osm-attribution.component.scss"],
    imports: []
})
export class OsmAttributionComponent {
    private readonly osmAddressService = inject(OsmAddressesService);
    private readonly runningContextService = inject(RunningContextService);

    public getEditAddress(): string {
        return this.osmAddressService.getOsmAddress();
    }

    public isMobile(): boolean {
        return this.runningContextService.isMobile;
    }
}