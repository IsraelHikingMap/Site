﻿import { Injectable } from "@angular/core";
import { Subject } from "rxjs";
import { LocalStorage } from "ngx-store";
import * as _ from "lodash";

import { IRouteLayer, IRoute, IRouteSegment, IMarkerWithData } from "./iroute.layer";
import { RouteLayerFactory } from "./route-layer.factory";
import { RouteLayer } from "./route.layer";
import { ResourcesService } from "../../resources.service";
import { IconsService } from "../../icons.service";
import { IRoutesService } from "./iroutes.service";
import { SpatialService } from "../../spatial.service";
import { RouteData, RouteSegmentData } from "../../../models/models";

@Injectable()
export class RoutesService implements IRoutesService {
    private static MERGE_THRESHOLD = 50; // meter.

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

    public splitSelectedRouteAt(segmenet: IRouteSegment) {
        let segmentIndex = this.selectedRoute.route.segments.indexOf(segmenet);
        let currentRoute = this.selectedRoute.route;
        this.selectedRoute.setHiddenState();
        let postFixSegments = currentRoute.segments.splice(segmentIndex + 1) as RouteSegmentData[];
        let startPoint = this.selectedRoute.getLastLatLng();
        postFixSegments.splice(0, 0,
            {
                latlngs: [startPoint, startPoint],
                routePoint: startPoint,
                routingType: postFixSegments[0].routingType
            } as RouteSegmentData);
        let routePostFix = {
            segments: postFixSegments,
            name: currentRoute.properties.name + this.resourcesService.split,
        } as RouteData;

        this.setData([routePostFix]);
        this.selectedRoute.setEditRouteState();
        this.selectedRoute.raiseDataChanged();
    }

    /**
     * This method is used to find the closest route in order to merge between routes.
     * @param isFirst use to signal the method if to check against the beginning or the end of the selected route.
     */
    public getClosestRoute(isFirst: boolean) {
        let latLngToCheck = isFirst
            ? this.selectedRoute.route.segments[0].latlngs[0]
            : this.selectedRoute.getLastLatLng();
        for (let routeLayer of this.routes) {
            if (routeLayer === this.selectedRoute || routeLayer.route.segments.length <= 0) {
                continue;
            }
            if (SpatialService.getDistance(routeLayer.getLastLatLng(),latLngToCheck) < RoutesService.MERGE_THRESHOLD) {
                return routeLayer;
            }
            if (SpatialService.getDistance(routeLayer.route.segments[0].latlngs[0], latLngToCheck) < RoutesService.MERGE_THRESHOLD) {
                return routeLayer;
            }
        }
        return null;
    }

    public mergeSelectedRouteToClosest(isFirst: boolean) {
        let closestRoute = this.getClosestRoute(isFirst);
        this.selectedRoute.setHiddenState();
        this.removeRoute(closestRoute.route.properties.name);
        let markersToAdd = closestRoute.route.markers;
        this.selectedRoute.route.markers = this.selectedRoute.route.markers.concat(markersToAdd);
        let latLngToCheck = isFirst
            ? this.selectedRoute.route.segments[0].latlngs[0]
            : this.selectedRoute.getLastLatLng();
        if (isFirst) {
            if (SpatialService.getDistanceInMeters(closestRoute.route.segments[0].latlngs[0], latLngToCheck) < RoutesService.MERGE_THRESHOLD) {
                closestRoute.reverse();
            }
            this.selectedRoute.route.segments.splice(0, 1);
            this.selectedRoute.route.segments[0].latlngs.splice(0, 0, closestRoute.getLastLatLng());
            this.selectedRoute.route.segments.splice(0, 0, ...closestRoute.route.segments);
        } else { // merging last point
            if (SpatialService.getDistanceInMeters(closestRoute.getLastLatLng(), latLngToCheck) < RoutesService.MERGE_THRESHOLD) {
                closestRoute.reverse();
            }
            // remove first segment and add last point:
            closestRoute.route.segments.splice(0, 1);
            closestRoute.route.segments[0].latlngs.splice(0, 0, this.selectedRoute.getLastLatLng());
            this.selectedRoute.route.segments.push(...closestRoute.route.segments);
        }
        this.selectedRoute.setEditRouteState();
        this.selectedRoute.raiseDataChanged();
    }

    public getOrCreateSelectedRoute(): IRouteLayer {
        if (this.selectedRoute == null && this.routes.length > 0) {
            this.changeRouteState(this.routes[0]);
        }
        if (this.routes.length === 0) {
            let properties = this.routeLayerFactory.createRoute(this.createRouteName()).properties;
            this.addRoute({ properties: properties, segments: [], markers: [] });
            this.selectedRoute.setState("ReadOnly");
        }
        return this.selectedRoute;
    }

    public addRouteToLocalStorage(route: RouteData) {
        this.locallyRecordedRoutes.push(route);
    }

    public removeRouteFromLocalStorage(route: RouteData) {
        let index = this.locallyRecordedRoutes.indexOf(route);
        this.locallyRecordedRoutes.splice(index, 1);
    }
}