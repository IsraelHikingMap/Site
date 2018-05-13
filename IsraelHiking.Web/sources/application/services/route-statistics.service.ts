import { Subject } from "rxjs/Subject";
import * as L from "leaflet";

import * as Common from "../common/IsraelHiking";

export interface IRouteStatisticsPoint extends L.Point {
    latlng: L.LatLng;
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

    public getStatisticsByRange = (route: Common.RouteData, start: IRouteStatisticsPoint, end: IRouteStatisticsPoint) => {
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
        let point = L.point(0, previousPoint.alt) as IRouteStatisticsPoint;
        point.latlng = previousPoint;
        point.slope = 0;
        routeStatistics.points.push(start || point);

        for (let segment of route.segments) {
            for (let latlng of segment.latlngs) {
                let distance = previousPoint.distanceTo(latlng);
                if (distance < 1) {
                    continue;
                }
                routeStatistics.length += distance;
                point = L.point((routeStatistics.length / 1000), latlng.alt) as IRouteStatisticsPoint;
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
        let simplified = L.LineUtil.simplify(routeStatistics.points, 1);
        let previousSimplifiedPoint = simplified[0];
        for (let simplifiedPoint of simplified) {
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

    public getStatistics = (route: Common.RouteData): IRouteStatistics => {
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
            point.latlng = this.getLatlngInterpolatedValue(previousPoint.latlng, currentPoint.latlng, ratio, point.y);
            return point;
        }
        return previousPoint;
    }

    private getInterpolatedValue(value1: number, value2: number, ratio: number) {
        return (value2 - value1) * ratio + value1;
    }

    private getLatlngInterpolatedValue(latlng1: L.LatLng, latlng2: L.LatLng, ratio: number, alt: number): L.LatLng {
        let returnValue = L.latLng(
            (latlng2.lat - latlng1.lat) * ratio + latlng1.lat,
            (latlng2.lng - latlng1.lng) * ratio + latlng1.lng,
            alt
        );
        return returnValue;
    }

    private isOnSegment(latlng1: L.LatLng, latlng2: L.LatLng, latlng: L.LatLng): boolean {
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
        let distance = L.LineUtil.pointToSegmentDistance(
            L.point(latlng1.lng, latlng1.lat),
            L.point(latlng2.lng, latlng2.lat),
            L.point(latlng.lng, latlng.lat));
        if (distance < 0.1) {
            return true;
        }
        return false;
    }

    public findDistanceForLatLng(statistics: IRouteStatistics, latLng: L.LatLng): number {
        if (statistics.points.length < 2) {
            return 0;
        }
        let previousPoint = statistics.points[0];
        for (let currentPoint of statistics.points) {
            if (this.isOnSegment(previousPoint.latlng, currentPoint.latlng, latLng) === false) {
                previousPoint = currentPoint;
                continue;
            }
            return previousPoint.x + previousPoint.latlng.distanceTo(latLng) / 1000;
        }
        return 0;
    }
}
