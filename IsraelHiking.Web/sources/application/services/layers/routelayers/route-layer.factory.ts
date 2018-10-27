import { Injectable, Injector, ComponentFactoryResolver } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { LocalStorage } from "ngx-store";

import { Urls } from "../../../urls";
import { RouteData, RoutingType } from "../../../models/models";


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

    @LocalStorage()
    public isRoutingPerPoint = true;
    @LocalStorage()
    public routingType: RoutingType = "Hike";
    @LocalStorage()
    public routeOpacity = 0.5;

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
            isRecording: false,
            color: this.colors[this.nextColorIndex],
            opacity: 0.5,
            weight: 4,
            markers: [],
            segments: []
        };
        this.nextColorIndex = (this.nextColorIndex + 1) % this.colors.length;
        return route;
    }
}