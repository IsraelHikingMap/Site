import { Component } from "@angular/core";
import { MapComponent } from "ngx-openlayers";
import { NgRedux } from "@angular-redux/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { LocationActions } from "../reducres/location.reducer";
import { ApplicationState } from "../models/models";

@Component({
    selector: "zoom",
    templateUrl: "./zoom.component.html"
})
export class ZoomComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }
    public zoomIn() {
        this.ngRedux.dispatch(LocationActions.zoomInAction);
    }

    public zoomOut() {
        this.ngRedux.dispatch(LocationActions.zoomOutAction);
    }
}