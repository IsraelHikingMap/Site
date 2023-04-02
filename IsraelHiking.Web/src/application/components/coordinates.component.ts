import { Component, Input, OnInit } from "@angular/core";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { ElevationProvider } from "../services/elevation.provider";
import { CoordinatesService } from "application/services/coordinates.service";
import type { LatLngAlt, NorthEast } from "../models/models";

@Component({
    selector: "coordinates",
    templateUrl: "./coordinates.component.html"
})
export class CoordinatesComponent extends BaseMapComponent implements OnInit {

    @Input()
    public latlng: LatLngAlt;

    public itmCoordinates: NorthEast;

    constructor(resources: ResourcesService,
                private readonly itmCoordinatesService: CoordinatesService,
                private readonly elevationProvider: ElevationProvider) {
        super(resources);
    }

    public async ngOnInit(): Promise<void> {
        this.itmCoordinates = this.itmCoordinatesService.toItm(this.latlng);
        await this.elevationProvider.updateHeights([this.latlng]);
    }
}
