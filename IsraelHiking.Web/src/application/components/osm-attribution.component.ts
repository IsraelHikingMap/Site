import { Component, inject } from "@angular/core";

import { OsmAddressesService } from "../services/osm-addresses.service";

@Component({
    selector: "osm-attribution",
    templateUrl: "./osm-attribution.component.html",
    styleUrls: ["./osm-attribution.component.scss"],
    imports: []
})
export class OsmAttributionComponent {
    private readonly OsmAttributionText = inject(OsmAddressesService);

    public getEditAddress(): string {
        return this.OsmAttributionText.getOsmAddress();
    }
}