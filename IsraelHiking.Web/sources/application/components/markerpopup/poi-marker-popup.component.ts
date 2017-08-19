import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import { ToastService } from "../../services/toast.service";
import { ElevationProvider } from "../../services/elevation.provider";
import { GeoJsonParser } from "../../services/geojson.parser";
import { Urls } from "../../common/Urls";
import * as Common from "../../common/IsraelHiking";


export interface IPointOfInterest {
    id: string;
    category: string;
    title: string;
    location: L.LatLng;
    source: string;
    icon: string;
    iconColor: string;
}

export interface IPointOfInterestExtended extends IPointOfInterest {
    imageUrl: string;
    description: string;
    rating: number;
    url: string;
    featureCollection: GeoJSON.FeatureCollection<GeoJSON.GeometryObject>;
}

@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poi-marker-popup.component.html"
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    public description: string;
    public thumbnail: string;
    public address: string;
    public source: string;
    private editMode: boolean;
    private route: Common.RouteData;
    private extendedDataArrivedDate: Date;

    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider,
        private geoJsonParser: GeoJsonParser,
        private toastService: ToastService) {
        super(resources, http, applicationRef, elevationProvider);
        this.editMode = false;
        this.extendedDataArrivedDate = null;
    }

    protected setMarkerInternal = (marker: Common.IMarkerWithTitle) => {
        this.marker = marker;
        this.title = marker.title;
        this.latLng = marker.getLatLng();
        this.marker.on("popupopen", () => {
            this.getPoiData();
        });
        this.marker.on("popupclose", () => {
            if (this.editMode) {
                this.toastService.warning(this.resources.closeWhileInEditMode);    
            }
            this.editMode = false;
        });
    }

    public selectRoute = (routeData: Common.RouteData): void => {
        console.log(routeData);
        throw new Error("This function must be assigned by containing layer!");
    };
    public clearSelectedRoute = (): void => { throw new Error("This function must be assigned by containing layer!") };

    public isEditMode(): boolean {
        return this.editMode;
    }

    public setEditMode() {
        this.editMode = true;
    }

    public save() {
        this.editMode = false;
        // HM TODO: send data to server.
    }

    private getPoiData() {
        if (this.extendedDataArrivedDate != null && this.extendedDataArrivedDate.getTime() - Date.now() < 5 * 1000) {
            this.selectRoute(this.route);
            return;
        }
        this.http.get(Urls.poi + this.source + "/" + this.marker.identifier,
            {
                params: { language: this.resources.getCurrentLanguageCodeSimplified() }
            }).toPromise().then((response) => {
                this.extendedDataArrivedDate = new Date();
                let poiExtended = response.json() as IPointOfInterestExtended;
                this.description = poiExtended.description;
                this.address = poiExtended.url;
                this.thumbnail = poiExtended.imageUrl;
                var container = this.geoJsonParser.toDataContainer(poiExtended.featureCollection);
                this.route = container.routes[0];
                this.selectRoute(this.route);
            });
    }
}