import { Input, OnInit } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";

import { ResourcesService } from "../../services/resources.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { BaseMapComponent } from "../base-map.component";
import { LatLngAlt } from "../../models/models";
import { Urls } from "../../urls";

export interface INorthEast {
    north: number;
    east: number;
}

export abstract class BaseMarkerPopupComponent extends BaseMapComponent implements OnInit {
    @Input()
    public latLng: LatLngAlt;
    @Input()
    public title: string;
    @Input()
    public close: () => void;
    @Input()
    public remove: () => void;

    public itmCoordinates: INorthEast;
    public hideCoordinates: boolean;
    

    constructor(resources: ResourcesService,
        protected httpClient: HttpClient,
        protected elevationProvider: ElevationProvider) {
        super(resources);
        this.hideCoordinates = true;
        this.itmCoordinates = { north: 0, east: 0 };
    }

    ngOnInit(): void {
        this.updateItmCoordinates();
        this.updateHeights();
    }

    private updateItmCoordinates = async () => {
        let params = new HttpParams()
            .set("lat", this.latLng.lat.toString())
            .set("lon", this.latLng.lng.toString());
        this.itmCoordinates = await this.httpClient.get(Urls.itmGrid, { params: params }).toPromise() as INorthEast;
    }

    private updateHeights = async () => {
        let array = [this.latLng];
        let updatedArray = await this.elevationProvider.updateHeights(array);
        this.latLng.alt = updatedArray[0].alt;
    }
}