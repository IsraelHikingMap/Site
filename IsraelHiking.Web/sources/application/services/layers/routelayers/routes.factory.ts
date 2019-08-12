import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { NgRedux } from "@angular-redux/store";

import { Urls } from "../../../urls";
import { RouteData, ApplicationState } from "../../../models/models";

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

    constructor(private readonly httpClient: HttpClient,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.httpClient.get(Urls.colors).toPromise().then((colors: string[]) => {
            this.colors.splice(0, this.colors.length, ...colors);
        });
    }

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
