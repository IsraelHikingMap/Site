import { Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";

import { Urls } from "../../../urls";
import { RouteData } from "../../../models/models";


@Injectable()
export class RouteLayerFactory {
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

    constructor(private readonly httpClient: HttpClient) {
        this.httpClient.get(Urls.colors).toPromise().then((colors: string[]) => {
            this.colors.splice(0, this.colors.length, ...colors);
        });
    }

    public createRouteData(name: string): RouteData {
        let route: RouteData = {
            id: Math.random().toString(36).substr(2, 9),
            name: name,
            description: "",
            state: "ReadOnly",
            color: this.colors[this.nextColorIndex],
            opacity: 0.5,
            weight: 4,
            markers: [],
            segments: []
        };
        this.nextColorIndex = (this.nextColorIndex + 1) % this.colors.length;
        return route;
    }

    public createRouteDataAddMissingFields(routeData: RouteData): RouteData {
        let route = { ...routeData };
        if (!route.color) {
            route.color = this.colors[this.nextColorIndex];
            this.nextColorIndex = (this.nextColorIndex + 1) % this.colors.length;
        }
        if (!route.opacity) {
            route.opacity = 0.5;
        }
        if (!route.weight) {
            route.weight = 4;
        }
        if (!route.id) {
            route.id = Math.random().toString(36).substr(2, 9);
        }
        route.state = "ReadOnly";
        return route;
    }
}