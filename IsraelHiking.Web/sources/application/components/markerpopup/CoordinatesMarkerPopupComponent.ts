import { Component, Input } from "@angular/core";
import { ResourcesService } from "../../services/ResourcesService";
import { INorthEast } from "./BaseMarkerPopupComponent";
import * as Common from "../../common/IsraelHiking";


@Component({
    selector: "coordinates",
    templateUrl: "./coordinatesMarkerPopup.html"
})
export class CoordinatesMarkerPopupComponent
{
    @Input()
    public latLng: L.LatLng;
    @Input()
    public itmCoordinates = null as INorthEast;
    @Input()
    public wikiCoordinatesString: string;

    constructor(public resources: ResourcesService) { }
}