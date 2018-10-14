import { Subject } from "rxjs";

import { SpatialService } from "./spatial.service";
import { ICoordinate, LatLngAlt, RouteData } from "../models/models";

export interface IRouteStatisticsPoint extends ICoordinate {
    latlng: LatLngAlt;
    slope: number;
}

export interface IRouteStatistics {
    points: IRouteStatisticsPoint[];
    length: number; // [meters]
    gain: number; // [meters] - adding only when going up hill.
    loss: number; // [meters] - adding only when going downhill - should be negative number.
}

export class RouteStatisticsService {
    private visible: boolean;
    public visibilityChanged: Subject<any>;

    constructor() {
        this.visibilityChanged = new Subject<{}>();
        this.visible = false;
    }

    public isVisible(): boolean {
        return this.visible;
    }

    public toggle = () => {
        this.visible = !this.visible;
        this.visibilityChanged.next();
    }

    public getStatisticsByRange = (route: RouteData, start: IRouteStatisticsPoint, end: IRouteStatisticsPoint) => {
        let routeStatistics = {
            points: [] as IRouteStatisticsPoint[],
            length: 0,
            gain: 0,
            loss: 0
        } as IRouteStatistics;
        if (route.segments.length <= 0) {
            return routeStatistics;
        }

        let previousPoint = route.segments[0].latlngs[0];
        let point = { x: 0, y: previousPoint.alt } as IRouteStatisticsPoint;
        point.latlng = previousPoint;
        point.slope = 0;
        routeStatistics.points.push(start || point);

        for (let segment of route.segments) {
            for (let latlng of segment.latlngs) {
                let distance = SpatialService.getDistanceInMeters(previousPoint, latlng);
                if (distance < 1) {
                    continue;
                }
                routeStatistics.length += distance;
                point = {
                    x: (routeStatistics.length / 1000),
                    y: latlng.alt
                } as IRouteStatisticsPoint;
                point.latlng = latlng;
                point.slope = distance === 0 ? 0 : (latlng.alt - previousPoint.alt) * 100 / distance;
                if (start == null || (point.x > start.x && point.x < end.x)) {
                    routeStatistics.points.push(point);
                }
                previousPoint = latlng;
            }
        }
        if (start != null && end != null) {
            routeStatistics.points.push(end);
            routeStatistics.length = (end.x - start.x) * 1000;
        }
        let previousSimplifiedPoint = routeStatistics.points[0];
        for (let simplifiedPoint of routeStatistics.points) {
            routeStatistics.gain += ((simplifiedPoint.y - previousSimplifiedPoint.y) > 0 && simplifiedPoint.y !== 0
                    && previousSimplifiedPoint.y !== 0)
                ? (simplifiedPoint.y - previousSimplifiedPoint.y)
                : 0;
            routeStatistics.loss += ((simplifiedPoint.y - previousSimplifiedPoint.y) < 0 && simplifiedPoint.y !== 0
                    && previousSimplifiedPoint.y !== 0)
                ? (simplifiedPoint.y - previousSimplifiedPoint.y)
                : 0;
            previousSimplifiedPoint = simplifiedPoint;
        }
        return routeStatistics;
    }

    public getStatistics = (route: RouteData): IRouteStatistics => {
        return this.getStatisticsByRange(route, null, null);
    }

    public interpolateStatistics(statistics: IRouteStatistics, x: number) {
        if (statistics == null || statistics.points.length < 2) {
            return null;
        }
        let previousPoint = statistics.points[0];
        if (x <= 0) {
            return previousPoint;
        }
        for (let currentPoint of statistics.points) {
            if (currentPoint.x < x) {
                previousPoint = currentPoint;
                continue;
            }
            if (currentPoint.x - previousPoint.x === 0) {
                previousPoint = currentPoint;
                continue;
            }
            let ratio = (x - previousPoint.x) / (currentPoint.x - previousPoint.x);
            let point = { x: x } as IRouteStatisticsPoint;
            point.y = this.getInterpolatedValue(previousPoint.y, currentPoint.y, ratio);
            point.slope = this.getInterpolatedValue(previousPoint.slope, currentPoint.slope, ratio);
            point.latlng = SpatialService.getLatlngInterpolatedValue(previousPoint.latlng, currentPoint.latlng, ratio, point.y);
            return point;
        }
        return previousPoint;
    }

    private getInterpolatedValue(value1: number, value2: number, ratio: number) {
        return (value2 - value1) * ratio + value1;
    }



    private isOnSegment(latlng1: LatLngAlt, latlng2: LatLngAlt, latlng: LatLngAlt): boolean {
        if (latlng2.lat > latlng1.lat) {
            if (latlng.lat < latlng1.lat) {
                return false;
            }
            if (latlng.lat > latlng2.lat) {
                return false;
            }
        } else {
            if (latlng.lat > latlng1.lat) {
                return false;
            }
            if (latlng.lat < latlng2.lat) {
                return false;
            }
        }
        if (latlng2.lng > latlng1.lng) {
            if (latlng.lng < latlng1.lng) {
                return false;
            }
            if (latlng.lng > latlng2.lng) {
                return false;
            }
        } else {
            if (latlng.lng > latlng1.lng) {
                return false;
            }
            if (latlng.lng < latlng2.lng) {
                return false;
            }
        }
        let distance = SpatialService.getDistanceFromPointToLine([latlng.lng, latlng.lat],
            [[latlng1.lng, latlng1.lat], [latlng2.lng, latlng2.lat]]);
        if (distance < 0.1) {
            return true;
        }
        return false;
    }

    public findDistanceForLatLng(statistics: IRouteStatistics, latLng: LatLngAlt): number {
        if (statistics.points.length < 2) {
            return 0;
        }
        let previousPoint = statistics.points[0];
        for (let currentPoint of statistics.points) {
            if (this.isOnSegment(previousPoint.latlng, currentPoint.latlng, latLng) === false) {
                previousPoint = currentPoint;
                continue;
            }
            return previousPoint.x + SpatialService.getDistanceInMeters(previousPoint.latlng, latLng) / 1000;
        }
        return 0;
    }
}
