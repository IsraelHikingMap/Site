import { Component, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";

import { BaseMarkerPopupComponent } from "./base-marker-popup.component";
import { ResourcesService } from "../../services/resources.service";
import {ElevationProvider} from "../../services/elevation.provider";
import * as Common  from "../../common/IsraelHiking";

@Component({
    selector: "poi-marker-popup",
    templateUrl: "./poi-marker-popup.component.html"
})
export class PoiMarkerPopupComponent extends BaseMarkerPopupComponent {
    public description: string;
    public thumbnail: string;
    public address: string;
    private editMode: boolean;

    constructor(resources: ResourcesService,
        http: Http,
        applicationRef: ApplicationRef,
        elevationProvider: ElevationProvider) {
        super(resources, http, applicationRef, elevationProvider);
        this.editMode = false;
    }

    protected setMarkerInternal = (marker: Common.IMarkerWithTitle) => {
        this.marker = marker;
        this.title = marker.title;
        this.latLng = marker.getLatLng();
        this.marker.on("popupclose", () => {
            // HM TODO: toaster warning in case in edit mode.
            this.editMode = false;
        });
    }

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
}