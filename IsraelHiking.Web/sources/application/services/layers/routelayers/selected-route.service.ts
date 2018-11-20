﻿import { Injectable } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { some } from "lodash";

import { SetSelectedRouteAction } from "../../../reducres/route-editing-state.reducer";
import {
    AddRouteAction,
    SplitRouteAction,
    ReverseRouteAction,
    MergeRoutesAction,
    UpdateSegmentsAction,
    DeleteSegmentAction,
    ReplaceSegmentsAction,
    AddPrivatePoiAction
} from "../../../reducres/routes.reducer";
import { RouteLayerFactory } from "./route-layer.factory";
import { ResourcesService } from "../../resources.service";
import { RouteData, ApplicationState, RouteSegmentData, ILatLngTime } from "../../../models/models";
import { SpatialService } from "../../spatial.service";
import { RouterService } from "../../routers/router.service";

@Injectable()
export class SelectedRouteService {
    private static MERGE_THRESHOLD = 50; // meter.

    private routes: RouteData[];
    private selectedRouteId: string;

    @select((state: ApplicationState) => state.routes.present)
    private routes$: Observable<RouteData[]>;

    @select((state: ApplicationState) => state.routeEditingState.selectedRouteId)
    private selectedRouteId$: Observable<string>;

    constructor(private readonly resourcesService: ResourcesService,
        private readonly routeLayerFactory: RouteLayerFactory,
        private readonly routerService: RouterService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        this.routes = [];
        this.routes$.subscribe((r) => {
            this.routes = r;
        });
        this.selectedRouteId$.subscribe((id) => {
            this.selectedRouteId = id;
        });
    }

    public getSelectedRoute(): RouteData {
        let route = this.getRouteById(this.selectedRouteId);
        if (route == null && this.selectedRouteId != null) {
            this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: null }));
        }
        return route;
    }

    public getRouteById(id: string): RouteData {
        return this.routes.find((r) => r.id === id);
    }

    public getOrCreateSelectedRoute(): RouteData {
        if (this.selectedRouteId === null && this.routes.length > 0) {
            this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: this.routes[0].id }));
        }
        if (this.routes.length === 0) {
            let data = this.routeLayerFactory.createRouteData(this.createRouteName());
            this.ngRedux.dispatch(new AddRouteAction({ routeData: data }));
            this.ngRedux.dispatch(new SetSelectedRouteAction({ routeId: data.id }));
        }
        return this.getSelectedRoute();
    }

    public createRouteName = (routeName: string = this.resourcesService.route) => {
        let index = 1;
        routeName = routeName.replace(/(.*) \d+/, "$1");
        let availableRouteName = `${routeName} ${index}`;
        while (some(this.routes, (route) => route.name === availableRouteName)) {
            index++;
            availableRouteName = `${routeName} ${index}`;
        }
        return availableRouteName;
    }

    public isNameAvailable = (name: string) => {
        let route = this.routes.find((routeToFind) => routeToFind.name === name);
        return route == null && name != null && name !== "";
    }

    /**
     * This method is used to find the closest route in order to merge between routes.
     * @param isFirst use to signal the method if to check against the beginning or the end of the selected route.
     */
    public getClosestRoute(isFirst: boolean) {
        let latLngToCheck = isFirst
            ? this.getSelectedRoute().segments[0].latlngs[0]
            : this.getLastLatLng(this.getSelectedRoute());
        for (let routeData of this.routes) {
            if (routeData.id === this.selectedRouteId || routeData.segments.length <= 0) {
                continue;
            }
            if (SpatialService.getDistanceInMeters(this.getLastLatLng(routeData), latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
                return routeData;
            }
            let firstLatLng = routeData.segments[0].latlngs[0];
            if (SpatialService.getDistanceInMeters(firstLatLng, latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
                return routeData;
            }
        }
        return null;
    }

    public getLastSegment(routeData: RouteData): RouteSegmentData {
        return routeData.segments[routeData.segments.length - 1];
    }

    public getLastLatLng(routeData: RouteData): ILatLngTime {
        let lastSegmentLatLngs = this.getLastSegment(routeData).latlngs;
        return lastSegmentLatLngs[lastSegmentLatLngs.length - 1];
    }

    public splitRoute(segmentIndex: number) {
        let selectedRoute = this.getSelectedRoute();
        let segments = [...selectedRoute.segments];
        let postfixSegments = segments.splice(segmentIndex + 1) as RouteSegmentData[];
        let startPoint = postfixSegments[0].latlngs[0];
        postfixSegments.splice(0, 0,
            {
                latlngs: [startPoint, startPoint],
                routePoint: startPoint,
                routingType: postfixSegments[0].routingType
            } as RouteSegmentData);
        let splitRouteData =
            this.routeLayerFactory.createRouteData(
                this.createRouteName(selectedRoute.name + " " + this.resourcesService.split));
        splitRouteData.segments = postfixSegments;
        let routeData = {
            ...selectedRoute,
            segments: segments
        };
        this.ngRedux.dispatch(new SplitRouteAction({
            routeId: selectedRoute.id,
            routeData: routeData,
            splitRouteData: splitRouteData
        }));
    }

    public mergeRoutes(isSelectedRouteSecond: boolean) {
        let closestRoute = this.getClosestRoute(isSelectedRouteSecond);
        let selectedRoute = this.getSelectedRoute();
        let mergedRoute = {
            ...selectedRoute,
            markers: [...selectedRoute.markers, ...closestRoute.markers]
        };
        let latLngToCheck = isSelectedRouteSecond
            ? selectedRoute.segments[0].latlngs[0]
            : this.getLastLatLng(selectedRoute);
        let closestRouteLatLngToCheck = isSelectedRouteSecond
            ? closestRoute.segments[0].latlngs[0]
            : this.getLastLatLng(closestRoute);

        if (SpatialService.getDistanceInMeters(closestRouteLatLngToCheck, latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
            closestRoute = this.reverseRouteInternal(closestRoute);
        }
        if (isSelectedRouteSecond) {
            let segments = [...selectedRoute.segments];
            segments.splice(0, 1);
            segments.splice(0, 0, ...closestRoute.segments);
            mergedRoute.segments = segments;
        } else {
            // remove first segment:
            let segments = [...closestRoute.segments];
            segments.splice(0, 1);
            segments.splice(0, 0, ...selectedRoute.segments);
            mergedRoute.segments = segments;
        }
        this.ngRedux.dispatch(new MergeRoutesAction({
            routeId: selectedRoute.id,
            secondaryRouteId: closestRoute.id,
            mergedRouteData: mergedRoute
        }));
    }

    private reverseRouteInternal(route: RouteData): RouteData {
        let segments = [];
        for (let segmentIndex = 0; segmentIndex < route.segments.length - 1; segmentIndex++) {
            let currentSegment = { ...route.segments[segmentIndex] };
            let nextSegment = { ...route.segments[segmentIndex + 1] };
            currentSegment.latlngs = [...nextSegment.latlngs].reverse();
            currentSegment.routingType = nextSegment.routingType;
            segments.push(currentSegment);
        }
        let lastSegment = { ...route.segments[route.segments.length - 1] };
        let lastPoint = lastSegment.latlngs[lastSegment.latlngs.length - 1];
        lastSegment.latlngs = [lastPoint, lastPoint];
        segments.push(lastSegment);
        segments = segments.reverse();
        return {
            ...route,
            segments: segments
        } as RouteData;
    }

    public reverseRoute(routeId?: string) {
        let route = routeId ? this.getRouteById(routeId) : this.getSelectedRoute();
        let revered = this.reverseRouteInternal(route);
        this.ngRedux.dispatch(new ReverseRouteAction({
            routeId: revered.id,
            routeData: revered
        }));
    }

    public async removeSegment(segmentIndex: number) {
        let selectedRoute = this.getSelectedRoute();
        if (selectedRoute.segments.length - 1 === segmentIndex) {
            this.ngRedux.dispatch(new DeleteSegmentAction({
                routeId: selectedRoute.id,
                index: selectedRoute.segments.length - 1
            }));
        } else {
            let latlngs = [
                selectedRoute.segments[segmentIndex + 1].routePoint,
                selectedRoute.segments[segmentIndex + 1].routePoint
            ];
            if (segmentIndex !== 0) {
                let startLatLng = selectedRoute.segments[segmentIndex].latlngs[0];
                let endLatLng = selectedRoute.segments[segmentIndex + 1].routePoint;
                let data = await this.routerService.getRoute(startLatLng, endLatLng, selectedRoute.segments[segmentIndex + 1].routingType);
                latlngs = data[data.length - 1].latlngs;
            }
            let updatedSegment = {
                ...selectedRoute.segments[segmentIndex + 1],
                latlngs: latlngs
            } as RouteSegmentData;
            this.ngRedux.dispatch(new UpdateSegmentsAction({
                routeId: selectedRoute.id,
                indices: [segmentIndex, segmentIndex + 1],
                segmentsData: [updatedSegment]
            }));
        }
    }

    public makeAllPointsEditable = (routeId: string) => {
        let route = this.getRouteById(routeId);
        if (!route || route.segments.length === 0) {
            return;
        }
        let segments = [];
        for (let segment of route.segments) {
            if (segment.latlngs.length === 0) {
                continue;
            }
            let previousPoint = segment.latlngs[0];
            for (let latLng of segment.latlngs) {
                if (previousPoint.lat === latLng.lat && previousPoint.lng === latLng.lng) {
                    continue;
                }
                segments.push({
                    latlngs: [previousPoint, latLng],
                    routingType: segment.routingType,
                    routePoint: latLng
                } as RouteSegmentData);
                previousPoint = latLng;
            }
        }
        this.ngRedux.dispatch(new ReplaceSegmentsAction({
            routeId: routeId,
            segmentsData: segments
        }));
    }

    public addRoutes(routes: RouteData[]) {
        if (routes.length === 1 && routes[0].segments.length === 0 && this.routes.length > 0) {
            // this is the case when the layer has markers only
            for (let marker of routes[0].markers) {
                this.ngRedux.dispatch(new AddPrivatePoiAction({
                    routeId: this.selectedRouteId || this.routes[0].id,
                    markerData: marker
                }));
            }
            if (this.selectedRouteId == null) {
                this.ngRedux.dispatch(new SetSelectedRouteAction({
                    routeId: this.routes[0].id
                }));
            }
            return;
        }
        for (let routeData of routes) {
            if (this.isNameAvailable(routeData.name) === false) {
                routeData.name = this.createRouteName(routeData.name);
            }
            let routeToAdd = this.routeLayerFactory.createRouteDataAddMissingFields(routeData);
            this.ngRedux.dispatch(new AddRouteAction({
                routeData: routeToAdd
            }));
        }
    }
}