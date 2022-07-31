import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";

import type { RouteData, ApplicationState } from "../models/models";

@Injectable()
export class RoutesFactory {

    // default values - in case the response from server takes too long.
    public colors: string[] = [
        "#0000FF",
        "#FF0000",
        "#FF6600",
        "#FF00DD",
        "#008000",
        "#B700FF",
        "#00B0A4",
        "#FFFF00",
        "#9C3E00",
        "#00FFFF",
        "#7F8282",
        "#101010"
    ];

    private nextColorIndex = 0;

    constructor(private readonly ngRedux: NgRedux<ApplicationState>) { }

    public createRouteData(name: string, color?: string): RouteData {
        let routeEditingState = this.ngRedux.getState().routeEditingState;
        let route: RouteData = {
            id: this.generateRandomId(),
            name,
            description: "",
            state: "ReadOnly",
            color: color || this.colors[this.nextColorIndex],
            opacity: routeEditingState.opacity,
            weight: routeEditingState.weight,
            markers: [],
            segments: []
        };
        this.nextColorIndex = (this.nextColorIndex + 1) % this.colors.length;
        return route;
    }

    public createRouteDataAddMissingFields(routeData: RouteData, color: string): RouteData {
        let routeEditingState = this.ngRedux.getState().routeEditingState;
        let route = { ...routeData };
        route.color = route.color || color;
        route.opacity = route.opacity || routeEditingState.opacity;
        route.weight = route.weight || routeEditingState.weight;
        route.id = route.id || this.generateRandomId();
        route.state = "ReadOnly";
        return route;
    }

    private generateRandomId() {
        return Math.random().toString(36).substr(2, 9);
    }
}
