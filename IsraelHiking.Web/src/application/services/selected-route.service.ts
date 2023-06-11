import { Injectable, EventEmitter } from "@angular/core";
import { Observable } from "rxjs";
import { some } from "lodash-es";
import { Store, Select } from "@ngxs/store";

import { RoutesFactory } from "./routes.factory";
import { ResourcesService } from "./resources.service";
import { SpatialService } from "./spatial.service";
import { RouterService } from "./router.service";
import { MINIMAL_ANGLE, MINIMAL_DISTANCE } from "./route-statistics.service";
import { SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import { ToggleAddRecordingPoiAction } from "../reducers/recorded-route.reducer";
import {
    AddRouteAction,
    SplitRouteAction,
    ReplaceRouteAction,
    MergeRoutesAction,
    UpdateSegmentsAction,
    DeleteSegmentAction,
    ReplaceSegmentsAction,
    AddPrivatePoiAction,
    ChangeRouteStateAction
} from "../reducers/routes.reducer";
import type {
    RouteData,
    ApplicationState,
    RouteSegmentData,
    LatLngAltTime,
    LatLngAlt,
    RouteEditStateType
} from "../models/models";

@Injectable()
export class SelectedRouteService {
    private static MERGE_THRESHOLD = 50; // meter.

    private routes: RouteData[];
    private selectedRouteId: string;

    @Select((state: ApplicationState) => state.routes.present)
    private routes$: Observable<RouteData[]>;

    @Select((state: ApplicationState) => state.routeEditingState.selectedRouteId)
    private selectedRouteId$: Observable<string>;

    public selectedRouteHover: EventEmitter<LatLngAlt>;

    constructor(private readonly resources: ResourcesService,
                private readonly routesFactory: RoutesFactory,
                private readonly routerService: RouterService,
                private readonly store: Store) {
        this.routes = [];
        this.selectedRouteHover = new EventEmitter();
        this.routes$.subscribe((r) => {
            this.routes = r;
        });
        this.selectedRouteId$.subscribe((id) => {
            this.selectedRouteId = id;
        });
    }

    public getSelectedRoute(): RouteData {
        const route = this.getRouteById(this.selectedRouteId);
        return route;
    }

    public syncSelectedRouteWithEditingRoute() {
        const editingRoute = this.routes.find(r => r.state === "Poi" || r.state === "Route");
        if (editingRoute != null && editingRoute.id !== this.selectedRouteId) {
            this.store.dispatch(new SetSelectedRouteAction(editingRoute.id));
        }
    }

    public areRoutesEmpty(): boolean {
        return this.routes.length === 0;
    }

    public getRouteById(id: string): RouteData {
        return this.routes.find((r) => r.id === id);
    }

    public getOrCreateSelectedRoute(): RouteData {
        if (this.selectedRouteId === null && this.routes.length > 0) {
            this.store.dispatch(new SetSelectedRouteAction(this.routes[0].id));
        }
        if (this.routes.length === 0) {
            const data = this.routesFactory.createRouteData(this.createRouteName(), this.getLeastUsedColor());
            this.store.dispatch(new AddRouteAction(data));
            this.setSelectedRoute(data.id);
        }
        return this.getSelectedRoute();
    }

    public setSelectedRoute(routeId: string) {
        if (this.selectedRouteId == null) {
            this.store.dispatch(new SetSelectedRouteAction(routeId));
        } else {
            const selectedRoute = this.getSelectedRoute();
            if (selectedRoute != null && selectedRoute.state !== "Hidden") {
                this.store.dispatch(new ChangeRouteStateAction(this.selectedRouteId, "ReadOnly"));
            }

            this.store.dispatch(new SetSelectedRouteAction(routeId));
        }
    }

    public changeRouteEditState(routeId: string, state: RouteEditStateType) {
        if (this.store.selectSnapshot((s: ApplicationState) => s.recordedRouteState).isAddingPoi) {
            this.store.dispatch(new ToggleAddRecordingPoiAction());
        }
        this.store.dispatch(new ChangeRouteStateAction(routeId, state));
    }

    public createRouteName(routeName: string = this.resources.route): string {
        let index = 1;
        routeName = routeName.replace(/(.*) \d+/, "$1");
        let availableRouteName = `${routeName} ${index}`;
        while (some(this.routes, (route) => route.name === availableRouteName)) {
            index++;
            availableRouteName = `${routeName} ${index}`;
        }
        return availableRouteName;
    }

    public getLeastUsedColor() {
        let colorCount = Number.POSITIVE_INFINITY;
        let selectedColor = this.routesFactory.colors[0];
        for (const color of this.routesFactory.colors) {
            const currentColorCount = this.routes.filter(r => r.color === color).length;
            if (currentColorCount < colorCount) {
                selectedColor = color;
                colorCount = currentColorCount;
            }
        }
        return selectedColor;
    }

    public isNameAvailable(name: string) {
        const route = this.routes.find((routeToFind) => routeToFind.name === name);
        return route == null && name != null && name !== "";
    }

    /**
     * This method is used to find the closest route in order to merge between routes.
     *
     * @param checkAgainstHead use to signal the method if to check against the beginning or the end of the selected route.
     */
    public getClosestRouteToSelected(checkAgainstHead: boolean): RouteData {
        const latLngToCheck = checkAgainstHead
            ? this.getSelectedRoute().segments[0].latlngs[0]
            : this.getLastLatLng(this.getSelectedRoute());
        for (const routeData of this.routes) {
            if (routeData.id === this.selectedRouteId || routeData.segments.length <= 0 || routeData.state === "Hidden") {
                continue;
            }
            if (SpatialService.getDistanceInMeters(this.getLastLatLng(routeData), latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
                return routeData;
            }
            const firstLatLng = routeData.segments[0].latlngs[0];
            if (SpatialService.getDistanceInMeters(firstLatLng, latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
                return routeData;
            }
        }
        return null;
    }

    public getClosestRouteToGPS(currentLocation: LatLngAltTime, heading: number): RouteData {
        if (currentLocation == null) {
            return null;
        }
        let routeToReturn = null;
        let minimalWeight = MINIMAL_DISTANCE;
        if (heading !== null) {
            minimalWeight += MINIMAL_ANGLE;
        }
        for (const routeData of this.routes) {
            if (routeData.segments.length <= 0 || routeData.state === "Hidden") {
                continue;
            }
            let previousLatLng = routeData.segments[0].latlngs[0];
            for (const segment of routeData.segments) {
                for (const latLng of segment.latlngs) {
                    if (latLng === previousLatLng) {
                        continue;
                    }
                    let currentWeight = SpatialService.getDistanceFromPointToLine(currentLocation, [previousLatLng, latLng]);
                    if (heading != null) {
                        currentWeight += Math.abs(heading - SpatialService.getLineBearingInDegrees(previousLatLng, latLng));
                    }
                    if (currentWeight < minimalWeight) {
                        minimalWeight = currentWeight;
                        routeToReturn = routeData;
                    }
                    previousLatLng = latLng;
                }
            }
        }
        return routeToReturn;
    }

    private getLastSegment(routeData: RouteData): RouteSegmentData {
        return routeData.segments[routeData.segments.length - 1];
    }

    private getLastLatLng(routeData: RouteData): LatLngAltTime {
        const lastSegmentLatLngs = this.getLastSegment(routeData).latlngs;
        return lastSegmentLatLngs[lastSegmentLatLngs.length - 1];
    }

    public splitRoute(segmentIndex: number) {
        const selectedRoute = this.getSelectedRoute();
        const segments = [...selectedRoute.segments];
        const postfixSegments = segments.splice(segmentIndex + 1) as RouteSegmentData[];
        const startPoint = postfixSegments[0].latlngs[0];
        postfixSegments.splice(0, 0,
            {
                latlngs: [startPoint, startPoint],
                routePoint: startPoint,
                routingType: postfixSegments[0].routingType
            } as RouteSegmentData);
        const newRouteName = selectedRoute.name.indexOf(this.resources.split) === -1
            ? selectedRoute.name + " " + this.resources.split
            : selectedRoute.name;
        const splitRouteData =
            this.routesFactory.createRouteData(
                this.createRouteName(newRouteName),
                this.getLeastUsedColor());
        splitRouteData.segments = postfixSegments;
        const routeData = {
            ...selectedRoute,
            segments
        };
        this.store.dispatch(new SplitRouteAction(selectedRoute.id, routeData, splitRouteData));
    }

    public mergeRoutes(isSelectedRouteSecond: boolean) {
        let closestRoute = this.getClosestRouteToSelected(isSelectedRouteSecond);
        const selectedRoute = this.getSelectedRoute();
        const mergedRoute = {
            ...selectedRoute,
            markers: [...selectedRoute.markers, ...closestRoute.markers]
        };
        const latLngToCheck = isSelectedRouteSecond
            ? selectedRoute.segments[0].latlngs[0]
            : this.getLastLatLng(selectedRoute);
        const closestRouteLatLngToCheck = isSelectedRouteSecond
            ? closestRoute.segments[0].latlngs[0]
            : this.getLastLatLng(closestRoute);

        if (SpatialService.getDistanceInMeters(closestRouteLatLngToCheck, latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
            closestRoute = this.reverseRouteInternal(closestRoute);
        }
        if (isSelectedRouteSecond) {
            const segments = [...selectedRoute.segments];
            segments.splice(0, 1);
            segments.splice(0, 0, ...closestRoute.segments);
            mergedRoute.segments = segments;
        } else {
            // remove first segment:
            const segments = [...closestRoute.segments];
            segments.splice(0, 1);
            segments.splice(0, 0, ...selectedRoute.segments);
            mergedRoute.segments = segments;
        }
        this.store.dispatch(new MergeRoutesAction(selectedRoute.id, closestRoute.id, mergedRoute));
    }

    private reverseRouteInternal(route: RouteData): RouteData {
        let segments = [];
        for (let segmentIndex = 0; segmentIndex < route.segments.length - 1; segmentIndex++) {
            const currentSegment = { ...route.segments[segmentIndex] };
            const nextSegment = { ...route.segments[segmentIndex + 1] };
            currentSegment.latlngs = [...nextSegment.latlngs].reverse();
            currentSegment.routingType = nextSegment.routingType;
            segments.push(currentSegment);
        }
        const lastSegment = { ...route.segments[route.segments.length - 1] };
        const lastPoint = lastSegment.latlngs[lastSegment.latlngs.length - 1];
        lastSegment.latlngs = [lastPoint, lastPoint];
        segments.push(lastSegment);
        segments = segments.reverse();
        return {
            ...route,
            segments
        } as RouteData;
    }

    public reverseRoute(routeId?: string) {
        const route = routeId ? this.getRouteById(routeId) : this.getSelectedRoute();
        const revered = this.reverseRouteInternal(route);
        this.store.dispatch(new ReplaceRouteAction(revered.id, revered));
    }

    public async removeSegment(segmentIndex: number) {
        const selectedRoute = this.getSelectedRoute();
        if (selectedRoute.segments.length - 1 === segmentIndex) {
            this.store.dispatch(new DeleteSegmentAction(selectedRoute.id, selectedRoute.segments.length - 1));
        } else {
            let latlngs = [
                selectedRoute.segments[segmentIndex + 1].routePoint,
                selectedRoute.segments[segmentIndex + 1].routePoint
            ];
            if (segmentIndex !== 0) {
                const startLatLng = selectedRoute.segments[segmentIndex].latlngs[0];
                const endLatLng = selectedRoute.segments[segmentIndex + 1].routePoint;
                latlngs = await this.routerService.getRoute(startLatLng, endLatLng, selectedRoute.segments[segmentIndex + 1].routingType);
            }
            const updatedSegment = {
                ...selectedRoute.segments[segmentIndex + 1],
                latlngs
            } as RouteSegmentData;
            this.store.dispatch(new UpdateSegmentsAction(selectedRoute.id, [segmentIndex, segmentIndex + 1],[updatedSegment]));
        }
    }

    public makeAllPointsEditable(routeId: string) {
        const route = this.getRouteById(routeId);
        if (!route || route.segments.length === 0) {
            return;
        }
        const segments = [];
        for (const segment of route.segments) {
            if (segment.latlngs.length === 0) {
                continue;
            }
            let previousPoint = segment.latlngs[0];
            for (const latLng of segment.latlngs) {
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
        this.store.dispatch(new ReplaceSegmentsAction(routeId, segments));
    }

    public addRoutes(routes: RouteData[]) {
        if (routes.length === 0) {
            return;
        }
        if (routes.length === 1 && routes[0].segments.length === 0 && this.routes.length > 0) {
            // this is the case when the layer has markers only
            for (const marker of routes[0].markers) {
                this.store.dispatch(new AddPrivatePoiAction(this.selectedRouteId || this.routes[0].id, marker));
            }
            if (this.selectedRouteId == null) {
                this.store.dispatch(new SetSelectedRouteAction(this.routes[0].id));
            }
            return;
        }
        for (const routeData of routes) {
            if (this.isNameAvailable(routeData.name) === false) {
                routeData.name = this.createRouteName(routeData.name);
            }
            const routeToAdd = this.routesFactory.createRouteDataAddMissingFields(routeData, this.getLeastUsedColor());
            this.store.dispatch(new AddRouteAction(routeToAdd));
            if (routes.indexOf(routeData) === 0) {
                this.setSelectedRoute(routeToAdd.id);
            }
        }
    }

    public raiseHoverSelectedRoute(latLng: LatLngAlt) {
        this.selectedRouteHover.emit(latLng);
    }

    public getLatlngs(route: RouteData): LatLngAltTime[] {
        return route ? [].concat(...route.segments.map(s => s.latlngs)) : null;// flatten
    }
}
