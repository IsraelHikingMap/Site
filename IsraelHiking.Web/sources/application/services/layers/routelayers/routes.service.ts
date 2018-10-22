import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { LocalStorage } from "ngx-store";
import * as _ from "lodash";

import { IRouteLayer, IRoute, IMarkerWithData } from "./iroute.layer";
import { RouteLayerFactory } from "./route-layer.factory";
import { RouteLayer } from "./route.layer";
import { ResourcesService } from "../../resources.service";
import { IconsService } from "../../icons.service";
import { RouteData } from "../../../models/models";

@Injectable()
export class RoutesService {
    @LocalStorage()
    public locallyRecordedRoutes: RouteData[] = [];

    public routes: IRouteLayer[];
    public routeChanged: Subject<any>;
    public selectedRoute: IRouteLayer;

    constructor(private readonly resourcesService: ResourcesService,
        private readonly routeLayerFactory: RouteLayerFactory) {
        this.routes = [];
        this.selectedRoute = null;
        this.routeChanged = new Subject<any>();
    }

    public addRoute = (route: IRoute) => {
        let routeLayer = this.routeLayerFactory.createRouteLayer(route);
        this.routes.push(routeLayer);
        routeLayer.show();
        routeLayer.setEditRouteState();
        this.selectRoute(routeLayer);
    }

    public removeRoute = (routeName: string) => {
        let routeLayer = this.getRouteByName(routeName);
        if (routeLayer == null) {
            return;
        }
        if (this.selectedRoute === routeLayer) {
            this.selectRoute(null);
        }
        (routeLayer as RouteLayer).hide();
        this.routes.splice(this.routes.indexOf(routeLayer), 1);
    }

    public isNameAvailable = (name: string) => {
        let route = this.getRouteByName(name);
        return route == null && name != null && name !== "";
    }

    public changeRouteState = (routeLayer: IRouteLayer) => {
        if (routeLayer === this.selectedRoute && routeLayer.route.properties.isVisible) {
            this.selectRoute(null);
            (routeLayer as RouteLayer).hide();
            return;
        }
        if (routeLayer.route.properties.isVisible === false) {
            (routeLayer as RouteLayer).show();
        }
        this.selectRoute(routeLayer);
    }

    private selectRoute = (routeLayer: IRouteLayer) => {
        if (this.selectedRoute) {
            this.selectedRoute.setReadOnlyState();
        }
        this.selectedRoute = routeLayer;
        this.routeChanged.next();
    }

    public createRouteName = (routeName: string = this.resourcesService.route) => {
        let index = 1;
        routeName = routeName.replace(/(.*) \d+/, "$1");
        let availableRouteName = `${routeName} ${index}`;
        while (_.some(this.routes, (routeLayer) => routeLayer.route.properties.name === availableRouteName)) {
            index++;
            availableRouteName = `${routeName} ${index}`;
        }
        return availableRouteName;
    }

    public getRouteByName = (routeName: string): IRouteLayer => {
        return _.find(this.routes, (routeLayerToFind) => routeLayerToFind.route.properties.name === routeName);
    }

    public getData = (): RouteData[] => {
        let routesData = [];
        for (let route of this.routes) {
            if (route.route.properties.isVisible) {
                routesData.push(route.getData());
            }
        }
        return routesData;
    }

    public setData = (routes: RouteData[]) => {
        if (!routes || routes.length === 0) {
            return;
        }
        for (let route of routes) {
            for (let marker of route.markers) {
                if (!_.find(IconsService.getAvailableIconTypes(), m => m === marker.type)) {
                    marker.type = IconsService.getAvailableIconTypes()[0];
                }
            }
        }
        this.addLayersToMap(routes);
    }

    private addLayersToMap = (routes: RouteData[]) => {
        if (routes.length === 1 && routes[0].segments.length === 0 && this.routes.length > 0) {
            // this is the case when the layer has markers only
            if (this.selectedRoute == null) {
                this.selectedRoute = this.routes[0];
            }
            let stateName = this.selectedRoute.getStateName();
            this.selectedRoute.setHiddenState();
            for (let marker of routes[0].markers) {
                this.selectedRoute.route.markers.push(marker as IMarkerWithData);
            }

            this.selectedRoute.setState(stateName);
            return;
        }
        for (let routeData of routes) {
            if (this.isNameAvailable(routeData.name) === false) {
                routeData.name = this.createRouteName(routeData.name);
            }
            let routeLayer = this.routeLayerFactory.createRouteLayerFromData(routeData);
            this.routes.push(routeLayer);
            // HM TODO: remove cast - add hide/show to interface
            (routeLayer as RouteLayer).show();
            this.selectRoute(routeLayer);
        }
    }
}