import { Injectable, Injector, ComponentFactoryResolver, ApplicationRef } from "@angular/core";
import { Http } from "@angular/http";
import { LocalStorage } from "ngx-store";
import { MapService } from "../../MapService";
import { RouterService } from "../../routers/RouterService";
import { SnappingService } from "../../SnappingService";
import { ElevationProvider } from "../../ElevationProvider";
import { IRouteLayer, IRoute, IRouteProperties, IRouteSegment, IMarkerWithData } from "./IRouteLayer";
import { RouteLayer } from "./RouteLayer";
import { Urls } from "../../../common/Urls";
import * as Common from "../../../common/IsraelHiking";
import "rxjs/add/operator/toPromise";

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
    public routingType = "Hike";
    @LocalStorage()
    public routeOpacity = 0.5;

    constructor(private http: Http,
        private mapService: MapService,
        private routerService: RouterService,
        private snappingService: SnappingService,
        private elevationProvider: ElevationProvider,
        private injector: Injector,
        private componentFactoryResolver: ComponentFactoryResolver,
        private applicationRef: ApplicationRef) {
        http.get(Urls.colors).toPromise().then((colors) => {
            this.colors.splice(0, this.colors.length, ...colors.json());
        });
    }

    public createRouteLayerFromData = (routeData: Common.RouteData, reRoute: boolean): IRouteLayer => {
        let routeLayer = this.createRouteLayer(this.createRouteFromData(routeData));
        if (reRoute) {
            routeLayer.reRoute();
        }
        return routeLayer;
    }

    public createRouteLayer = (route: IRoute): RouteLayer => {
        return new RouteLayer(this.mapService,
            this.snappingService,
            this.routerService,
            this.elevationProvider,
            this.injector,
            this.componentFactoryResolver,
            this.applicationRef,
            route);
    }

    private createRouteImplementation(name: string, pathOptions: L.PathOptions): IRoute {
        let route = {
            properties: {
                name: name,
                currentRoutingType: this.routingType,
                isRoutingPerPoint: this.isRoutingPerPoint,
                isVisible: true,
                pathOptions: {
                    color: pathOptions.color || this.colors[this.nextColorIndex],
                    className: "",
                    opacity: pathOptions.opacity || this.routeOpacity,
                    weight: pathOptions.weight || 4
                } as L.PathOptions
            } as IRouteProperties,
            markers: [],
            segments: []
        } as IRoute;
        this.nextColorIndex = (this.nextColorIndex + 1) % this.colors.length;
        return route;
    }

    public createRoute(name: string): IRoute {
        return this.createRouteImplementation(name, { color: "", opacity: null, weight: null } as L.PathOptions)
    }

    public createRouteFromData(routeData: Common.RouteData): IRoute {
        let pathOptions = { color: routeData.color, opacity: routeData.opacity, weight: routeData.weight } as L.PathOptions;
        let route = this.createRouteImplementation(routeData.name, pathOptions);
        route.segments = routeData.segments as IRouteSegment[] || [];
        route.markers = routeData.markers as IMarkerWithData[] || [];
        return route;
    }
}