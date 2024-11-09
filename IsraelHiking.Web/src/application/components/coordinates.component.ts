import { Component, inject, input, OnInit } from "@angular/core";

import { ResourcesService } from "../services/resources.service";
import { ElevationProvider } from "../services/elevation.provider";
import { CoordinatesService } from "../services/coordinates.service";
import type { LatLngAlt, NorthEast } from "../models/models";

@Component({
    selector: "coordinates",
    templateUrl: "./coordinates.component.html"
})
export class CoordinatesComponent implements OnInit {

    public latlng = input<LatLngAlt>();

    public itmCoordinates: NorthEast;

    public readonly resources = inject(ResourcesService);

    private readonly itmCoordinatesService = inject(CoordinatesService);
    private readonly elevationProvider = inject(ElevationProvider);

    public async ngOnInit(): Promise<void> {
        this.itmCoordinates = this.itmCoordinatesService.toItm(this.latlng());
        await this.elevationProvider.updateHeights([this.latlng()]);
    }
}
