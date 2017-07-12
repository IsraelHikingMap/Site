import { Injectable } from "@angular/core";
import { Subject } from "rxjs/Subject";
import * as _ from "lodash";

import { IRouteLayer, IRoute } from "./iroute.layer";
import { MapService } from "../../map.service";
import { RouteLayerFactory } from "./route-layer.factory";
import { RouteLayer } from "./route.layer";
import { ResourcesService } from "../../resources.service";
import * as Common from "../../../common/IsraelHiking";
import {IconsService} from "../../icons.service";

@Injectable()
export class RoutesService {

    public routes: IRouteLayer[];
    public routeChanged: Subject<any>;
    public selectedRoute: IRouteLayer;

    constructor(private resourcesService: ResourcesService,
        private mapService: MapService,
        private routeLayerFactory: RouteLayerFactory) {
        this.routes = [];
        this.selectedRoute = null;
        this.routeChanged = new Subject<any>();
        // Add default route
        let routes = [{
            name: this.createRouteName(),
            markers: [],
            segments: []
        }] as Common.RouteData[];
        this.addLayersToMap(routes);
    }

    public addRoute = (route: IRoute) => {
        let routeLayer = this.routeLayerFactory.createRouteLayer(route);
        this.routes.push(routeLayer);
        this.mapService.map.addLayer(routeLayer);
        this.selectRoute(routeLayer);
    }

    public isNameAvailable = (name: string) => {
        var route = this.getRouteByName(name);
        return route == null && name != null && name !== "";
    }

    public removeRoute = (routeName: string) => {
        let routeLayer = this.getRouteByName(routeName);
        if (routeLayer == null) {
            return;
        }
        if (this.selectedRoute === routeLayer) {
            this.selectRoute(null);
        }
        this.mapService.map.removeLayer(routeLayer as RouteLayer);
        this.routes.splice(this.routes.indexOf(routeLayer), 1);
    }

    public changeRouteState = (routeLayer: IRouteLayer) => {
        if (routeLayer === this.selectedRoute && routeLayer.route.properties.isVisible) {
            this.selectRoute(null);
            this.mapService.map.removeLayer(routeLayer as RouteLayer);
            return;
        }
        if (routeLayer.route.properties.isVisible === false) {
            this.mapService.map.addLayer(routeLayer as RouteLayer);
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

    public createRouteName = () => {
        var index = 1;
        var routeName = `${this.resourcesService.route} ${index}`;
        while (_.some(this.routes, (routeLayer) => routeLayer.route.properties.name === routeName)) {
            index++;
            routeName = `${this.resourcesService.route} ${index}`;
        }
        return routeName;
    }

    public getRouteByName = (routeName: string): IRouteLayer => {
        return _.find(this.routes, (routeLayerToFind) => routeLayerToFind.route.properties.name === routeName);
    }

    public getData = (): Common.RouteData[] => {
        let routesData = [];
        for (let route of this.routes) {
            if (route.route.properties.isVisible) {
                routesData.push(route.getData());
            }
        }
        return routesData;
    }
    
    public setData = (routes: Common.RouteData[]) => {
        if (!routes || routes.length === 0) {
            return;
        }
        for (let route of routes) {
            for (let segment of route.segments) {
                let latlngs = [] as L.LatLng[];
                for (let latlng of segment.latlngs) {
                    var fullLatLng = L.latLng(latlng.lat, latlng.lng, latlng.alt);
                    latlngs.push(fullLatLng);
                }
                segment.latlngs = latlngs;
                segment.routePoint = L.latLng(segment.routePoint.lat, segment.routePoint.lng);
            }
            route.markers = route.markers || [];
            for (let marker of route.markers) {
                marker.latlng = L.latLng(marker.latlng.lat, marker.latlng.lng);
                if (!_.find(IconsService.getAvailableIconTypes(), m => m === marker.type)) {
                    marker.type = IconsService.getAvailableIconTypes()[0];
                }
            }
        }
        this.addLayersToMap(routes);
    }

    private addLayersToMap = (routes: Common.RouteData[]) => {
        for (let routeData of routes) {
            if (this.isNameAvailable(routeData.name) === false) {
                routeData.name = this.createRouteName();
            }
            let routeLayer = this.routeLayerFactory.createRouteLayerFromData(routeData);
            this.routes.push(routeLayer);
            this.mapService.map.addLayer(routeLayer as RouteLayer);
            this.selectRoute(routeLayer);
        }
    }
}