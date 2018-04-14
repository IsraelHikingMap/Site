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
        this.hidden = true;
        this.point = { x: 0, y: 0, slope: 0 } as IRouteStatisticsPoint;
    }

    public setPosition(end: number) {
        this.element.nativeElement.children[0].style.left = end + "px";
    }

    public getWidth(): number {
        return +this.element.nativeElement.children[0].getBoundingClientRect().width;
    }
}