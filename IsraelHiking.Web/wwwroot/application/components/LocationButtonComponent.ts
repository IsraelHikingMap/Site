import { Component, ElementRef } from "@angular/core";
import { ResourcesService } from "../services/ResourcesService";
import { BaseMapComponent } from "./BaseMapComponent";

@Component({
    selector: "location-button",
    template:   `<a mdTooltip="{{resources.showMeWhereIAm}}" mdTooltipPosition="right">
                    <i class="fa fa-lg icon-crosshairs"></i>
                </a>`
})
export class LocationButtonComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        public elemnt: ElementRef) {
        super(resources);
    }

}