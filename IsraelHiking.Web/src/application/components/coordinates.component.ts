import { Component, Input, OnInit } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { firstValueFrom } from "rxjs";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { ElevationProvider } from "../services/elevation.provider";
import { Urls } from "../urls";
import type { LatLngAlt, NorthEast } from "../models/models";

@Component({
    selector: "coordinates",
    templateUrl: "./coordinates.component.html"
})
export class CoordinatesComponent extends BaseMapComponent implements OnInit {

    @Input()
    public latlng: LatLngAlt;

    @Input()
    public itmCoordinates?: NorthEast;

    constructor(resources: ResourcesService,
                private readonly httpClient: HttpClient,
                private readonly elevationProvider: ElevationProvider) {
        super(resources);
    }

    public async ngOnInit(): Promise<void> {
        let params = new HttpParams()
            .set("lat", this.latlng.lat.toString())
            .set("lon", this.latlng.lng.toString());
        if (!this.itmCoordinates) {
            this.itmCoordinates = await firstValueFrom(this.httpClient.get(Urls.itmGrid, { params })) as NorthEast;
        }
        let response = await this.elevationProvider.updateHeights([this.latlng]);
        this.latlng.alt = response[0].alt;
    }
}
