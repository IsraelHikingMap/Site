import { Component, ViewEncapsulation, ElementRef } from "@angular/core";

import { IRouteStatisticsPoint } from "../services/route-statistics.service";
import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";

@Component({
    selector: "route-statistics-chart-tooltip",
    templateUrl: "./route-statistics-chart-tooltip.component.html",
    styleUrls: ["./route-statistics-chart-tooltip.component.css"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteStatisticsChartTooltipComponent extends BaseMapComponent {
    public point: IRouteStatisticsPoint;
    public hidden: boolean;
    
    constructor(resources: ResourcesService, private element: ElementRef) {
        super(resources);
        this.hidden = false;
        this.point = { x: 0, y: 0, slope: 0 } as IRouteStatisticsPoint;
    }

    public setPosition(end: number) {
        if (this.resources.direction === "rtl") {
            // hack... :-(
            end -= 20;
        }
        this.element.nativeElement.children[0].style.left = end + "px";
    }
}