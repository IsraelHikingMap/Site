import { Injectable, EventEmitter, inject } from "@angular/core";
import { some } from "lodash-es";
import { Store } from "@ngxs/store";
import { v4 as uuidv4 } from "uuid";
import type { Immutable } from "immer";

import { RoutesFactory } from "./routes.factory";
import { ResourcesService } from "./resources.service";
import { SpatialService } from "./spatial.service";
import { RoutingProvider } from "./routing.provider";
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
} from "../models";

@Injectable()
export class SelectedRouteService {
    private static MERGE_THRESHOLD = 50; // meter.

    private routes: Immutable<RouteData[]> = [];
    private selectedRouteId: string;

    public selectedRouteHover = new EventEmitter<LatLngAlt>;

    private readonly resources = inject(ResourcesService);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly routingProvider = inject(RoutingProvider);
    private readonly store = inject(Store);
    
    constructor() {
        this.store.select((state: ApplicationState) => state.routes.present).subscribe((r) => {
            this.routes = r;
        });
        this.store.select((state: ApplicationState) => state.routeEditingState.selectedRouteId).subscribe((id) => {
            this.selectedRouteId = id;
        });
    }

    public getSelectedRoute(): Immutable<RouteData> {
        return this.getRouteById(this.selectedRouteId);
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

    public getRouteById(id: string): Immutable<RouteData> {
        return this.routes.find((r) => r.id === id);
    }

    public getOrCreateSelectedRoute(): Immutable<RouteData> {
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
        let availableRouteName = routeName;
        if (routeName.match(/\d+$/)) {
            // remove trailing numbers
            routeName = routeName.replace(/(.*) \d+/, "$1");
        }
        let index = 0;
        while (some(this.routes, (route) => route.name === availableRouteName)) {
            index++;
            availableRouteName = `${routeName} ${index}`;
        }
        return availableRouteName;
    }

    public getLeastUsedColor() {
        let colorCount = Infinity;
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
    public getClosestRouteToSelected(checkAgainstHead: boolean): Immutable<RouteData> {
        const latLngToCheck = checkAgainstHead
            ? this.getSelectedRoute().segments[0].latlngs[0]
            : this.getLastLatLng(this.getSelectedRoute());
        let closetRoute = null;
        let minimalDistance = Infinity;
        for (const routeData of this.routes) {
            if (routeData.id === this.selectedRouteId || routeData.segments.length <= 0 || routeData.state === "Hidden") {
                continue;
            }
            const firstLatLng = routeData.segments[0].latlngs[0];
            const distanceToEnd = SpatialService.getDistanceInMeters(this.getLastLatLng(routeData), latLngToCheck);
            const distanceToStart = SpatialService.getDistanceInMeters(firstLatLng, latLngToCheck);
            const distance = Math.min(distanceToEnd, distanceToStart);
            if (distance < SelectedRouteService.MERGE_THRESHOLD && distance < minimalDistance) {
                closetRoute = routeData;
                minimalDistance = distance;
            }
        }
        return closetRoute;
    }

    /**
     * This will find the closest route to the GPS position,
     * It will start with trying to find the closest route with the best direction
     * and fall back to only distance if no route was found
     * @param currentLocation - the currecnt GPS location
     * @param heading - the current GPS heading, null when standing still
     * @returns the closest route
     */
    public getClosestRouteToGPS(currentLocation: LatLngAltTime, heading: number): Immutable<RouteData> {
        if (currentLocation == null) {
            return null;
        }
        let routeToReturn = this.getClosestRouteToGPSInternal(currentLocation, heading);
        if (routeToReturn == null && heading != null) {
            // In case there is no closest route, ignore heading and fallback to just distance based.
            routeToReturn = this.getClosestRouteToGPSInternal(currentLocation, null);
        }
        return routeToReturn
    }

    private getClosestRouteToGPSInternal(currentLocation: LatLngAltTime, heading: number): Immutable<RouteData> {
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

    private getLastSegment(routeData: Immutable<RouteData>): Immutable<RouteSegmentData> {
        return routeData.segments[routeData.segments.length - 1];
    }

    private getLastLatLng(routeData: Immutable<RouteData>): LatLngAltTime {
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
        } as RouteData;
        this.store.dispatch(new SplitRouteAction(selectedRoute.id, routeData, splitRouteData));
    }

    public mergeRoutes(isSelectedRouteSecond: boolean) {
        let closestRoute = this.getClosestRouteToSelected(isSelectedRouteSecond);
        const selectedRoute = this.getSelectedRoute();
        const mergedRoute = {
            ...selectedRoute,
            markers: [...selectedRoute.markers, ...closestRoute.markers]
        } as RouteData;
        const latLngToCheck = isSelectedRouteSecond
            ? selectedRoute.segments[0].latlngs[0]
            : this.getLastLatLng(selectedRoute);
        const closestRouteLatLngToCheck = isSelectedRouteSecond
            ? closestRoute.segments[0].latlngs[0]
            : this.getLastLatLng(closestRoute);

        if (SpatialService.getDistanceInMeters(closestRouteLatLngToCheck, latLngToCheck) < SelectedRouteService.MERGE_THRESHOLD) {
            closestRoute = this.reverseRouteInternal(closestRoute);
        }
        const firstPart = structuredClone(isSelectedRouteSecond ? closestRoute.segments : selectedRoute.segments) as RouteSegmentData[]; 
        const secondPart = structuredClone(isSelectedRouteSecond ? selectedRoute.segments : closestRoute.segments) as RouteSegmentData[];

        // remove first segment (which is a signle point):
        secondPart.splice(0, 1);
        const lastSegmentLatlngs = firstPart[firstPart.length - 1].latlngs;
        const lastLatlngOfFirstPart = lastSegmentLatlngs[lastSegmentLatlngs.length - 1];
        if (lastLatlngOfFirstPart.lat !== secondPart[0].latlngs[0].lat && 
            lastLatlngOfFirstPart.lng !== secondPart[0].latlngs[0].lng) {
                secondPart[0].latlngs.splice(0, 0, lastLatlngOfFirstPart);
        }
        mergedRoute.segments = firstPart.concat(secondPart);
        this.store.dispatch(new MergeRoutesAction(selectedRoute.id, closestRoute.id, mergedRoute));
    }

    private reverseRouteInternal(route: Immutable<RouteData>): RouteData {
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
                latlngs = await this.routingProvider.getRoute(startLatLng, endLatLng, selectedRoute.segments[segmentIndex + 1].routingType);
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
        const segments = [structuredClone(route.segments[0]) as RouteSegmentData];
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
                if (!marker.id) {
                    marker.id = uuidv4();
                }
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

    public getLatlngs(route: Immutable<RouteData>): LatLngAltTime[] {
        return route ? route.segments.map(s => s.latlngs).flat() : null;
    }
}
