import { Component, Input } from "@angular/core";
import { ResourcesService } from "../../services/resources.service";
import { INorthEast } from "./base-marker-popup.component";
import { BaseMapComponent } from "../base-map.component";
import { LatLngAlt } from "../../models/models";

@Component({
    selector: "coordinates",
    templateUrl: "./coordinates-marker-popup.component.html"
})
export class CoordinatesMarkerPopupComponent extends BaseMapComponent {

    @Input()
    public latLng: LatLngAlt;
    @Input()
    public itmCoordinates = null as INorthEast;

    constructor(resources: ResourcesService) {
        super(resources);
    }
}