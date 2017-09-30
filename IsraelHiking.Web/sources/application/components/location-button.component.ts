import { Component, ElementRef } from "@angular/core";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";

@Component({
    selector: "location-button",
    template:   `<a matTooltip="{{resources.showMeWhereIAm}}" matTooltipPosition="right">
                    <i class="fa fa-lg icon-crosshairs"></i>
                </a>`
})
export class LocationButtonComponent extends BaseMapComponent {
    constructor(resources: ResourcesService,
        public elemnt: ElementRef) {
        super(resources);
    }

}