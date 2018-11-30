import { Component, Input, OnInit } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { ElevationProvider } from "../services/elevation.provider";
import { Urls } from "../urls";
import { LatLngAlt } from "../models/models";

export interface INorthEast {
    north: number;
    east: number;
}

@Component({
    selector: "coordinates",
    templateUrl: "./coordinates.component.html"
})
export class CoordinatesComponent extends BaseMapComponent implements OnInit {

    @Input()
    public latlng: LatLngAlt;

    public itmCoordinates: INorthEast;

    constructor(resources: ResourcesService,
        private readonly httpClient: HttpClient,
        private readonly elevationProvider: ElevationProvider) {
        super(resources);
        this.itmCoordinates = { north: 0, east: 0 };
    }

    public async ngOnInit(): Promise<any> {
        let params = new HttpParams()
            .set("lat", this.latlng.lat.toString())
            .set("lon", this.latlng.lng.toString());
        this.itmCoordinates = await this.httpClient.get(Urls.itmGrid, { params: params }).toPromise() as INorthEast;
        let response = await this.elevationProvider.updateHeights([this.latlng]);
        this.latlng.alt = response[0].alt;
    }
}