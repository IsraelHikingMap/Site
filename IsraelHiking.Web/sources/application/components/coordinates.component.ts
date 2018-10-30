import { Component, Input, OnInit } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
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
        protected httpClient: HttpClient) {
        super(resources);
        this.itmCoordinates = { north: 0, east: 0 };
    }

    ngOnInit(): void {
        this.updateItmCoordinates();
    }

    private updateItmCoordinates = async () => {
        let params = new HttpParams()
            .set("lat", this.latlng.lat.toString())
            .set("lon", this.latlng.lng.toString());
        this.itmCoordinates = await this.httpClient.get(Urls.itmGrid, { params: params }).toPromise() as INorthEast;
    }
}