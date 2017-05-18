import { Http } from "@angular/http";
import { ResourcesService } from "../../services/ResourcesService";
import { ElevationProvider } from "../../services/ElevationProvider";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";

export interface INorthEast {
    north: number;
    east: number;
}

export abstract class BaseMarkerPopupComponent {
    protected marker: Common.IMarkerWithTitle;
    public title: string;
    public latLng: L.LatLng;
    public itmCoordinates: INorthEast;
    public wikiCoordinatesString: string;
    public hideCoordinates: boolean;

    public remove: () => void;

    constructor(public resources: ResourcesService,
        protected http: Http,
        protected elevationProvider: ElevationProvider) {
        this.hideCoordinates = true;
        this.latLng = L.latLng(0, 0, 0);
        this.itmCoordinates = { north: 0, east: 0 };
        this.wikiCoordinatesString = "";
    }

    public setMarker(marker: Common.IMarkerWithTitle) {
        this.setMarkerInternal(marker);
    }

    protected setMarkerInternal = (marker: Common.IMarkerWithTitle) => {
        this.marker = marker;
        this.title = this.marker.title;
        this.marker.on("popupopen", () => {
            this.latLng = { ...this.marker.getLatLng(), alt: 0 } as L.LatLng;
            this.http.get(Urls.itmGrid, {
                params: {
                    lat: this.latLng.lat,
                    lon: this.latLng.lng
                }
            }).toPromise().then((northEast) => {
                this.itmCoordinates = northEast.json();
            });
            var array = [this.latLng];
            this.elevationProvider.updateHeights(array).then(() => {
                this.latLng = array[0];
            });
        });
    }
} 