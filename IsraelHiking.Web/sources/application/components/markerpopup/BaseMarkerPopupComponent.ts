import { Http } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { ElevationProvider } from "../../services/ElevationProvider";
import { Urls } from "../../common/Urls";
import { BaseMapComponent } from "../BaseMapComponent";
import * as Common from "../../common/IsraelHiking";

export interface INorthEast {
    north: number;
    east: number;
}

export abstract class BaseMarkerPopupComponent extends BaseMapComponent {
    protected marker: Common.IMarkerWithTitle;
    public title: string;
    public latLng: L.LatLng;
    public itmCoordinates: INorthEast;
    public hideCoordinates: boolean;

    public remove: () => void;

    constructor(resources: ResourcesService,
        protected http: Http,
        protected elevationProvider: ElevationProvider) {
        super(resources);
        this.hideCoordinates = true;
        this.latLng = L.latLng(0, 0, 0);
        this.itmCoordinates = { north: 0, east: 0 };
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);
    }

    protected setMarkerInternal = (marker: Common.IMarkerWithTitle) => {
        this.marker = marker;
        this.title = this.marker.title;
        this.latLng = this.marker.getLatLng();
        this.updateItmCoordinates();
        this.updateHeights();

        this.marker.on("dragend", () => {
            this.latLng = this.marker.getLatLng();
            this.updateItmCoordinates();
            this.updateHeights();
        });
    }

    private updateItmCoordinates = () => {
        this.http.get(Urls.itmGrid, {
            params: {
                lat: this.latLng.lat,
                lon: this.latLng.lng
            }
        }).toPromise().then((northEast) => {
            this.itmCoordinates = northEast.json();
        });
    }

    private updateHeights = () => {
        var array = [this.latLng];
        this.elevationProvider.updateHeights(array).then(() => {
            this.latLng = array[0];
        });
    }
} 