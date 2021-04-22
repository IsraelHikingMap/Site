import { Injectable } from "@angular/core";
import { last } from "lodash-es";

import { SpatialService } from "./spatial.service";
import { LatLngAlt, RouteData, ILatLngTime } from "../models/models";

export const MINIMAL_DISTANCE = 50;
export const MINIMAL_ANGLE = 30;

export interface IRouteStatisticsPoint {
    /**
     * x - distance in KM, y - altitude in meters
     */
    coordinate: [number, number];
    latlng: LatLngAlt;
    slope: number;
}

export interface IRouteStatistics {
    points: IRouteStatisticsPoint[];
    /**
     * Route length in meters
     */
    length: number;
    /**
     * gain (adding only when going up hill) in meters
     */
    gain: number;
    /**
     * loss (adding only when going downhill - should be negative number) in meters
     */
    loss: number;
    /**
     * The time in seconds it took to do this route - only if there is time information
     */
    duration: number;
    /**
     * The average speed in km/hour for this route
     */
    averageSpeed: number;
    /**
     * The distnace in meters left to the end of the planned route
     */
    remainingDistance: number;
}

@Injectable()
export class RouteStatisticsService {
    public getStatisticsByRange(route: RouteData, start: IRouteStatisticsPoint, end: IRouteStatisticsPoint): IRouteStatistics {
        let routeStatistics = {
            points: [] as IRouteStatisticsPoint[],
            length: 0,
            gain: 0,
            loss: 0,
            remainingDistance: null,
            duration: null,
            averageSpeed: null
        } as IRouteStatistics;
        if (route.segments.length <= 0) {
            return routeStatistics;
        }

        let previousPoint = route.segments[0].latlngs[0];
        let point = { coordinate: [0, previousPoint.alt] } as IRouteStatisticsPoint;
        point.latlng = previousPoint;
        point.slope = 0;
        routeStatistics.points.push(start || point);

        for (let segment of route.segments) {
            for (let latlng of segment.latlngs) {
                let distance = SpatialService.getDistanceInMeters(previousPoint, latlng);
                if (distance < 1 || isNaN(latlng.alt)) {
                    continue;
                }
                routeStatistics.length += distance;
                point = {
                    coordinate: [(routeStatistics.length / 1000), latlng.alt]
                } as IRouteStatisticsPoint;
                point.latlng = latlng;
                point.slope = distance === 0 ? 0 : (latlng.alt - previousPoint.alt) * 100 / distance;
                if (start == null || (point.coordinate[0] > start.coordinate[0] && point.coordinate[0] < end.coordinate[0])) {
                    routeStatistics.points.push(point);
                }
                previousPoint = latlng;
            }
        }
        if (start != null && end != null) {
            routeStatistics.points.push(end);
            routeStatistics.length = (end.coordinate[0] - start.coordinate[0]) * 1000;
        }
        // smooth the line in order to better calculate gain and loss:
        // changing x from Km to Km * 100 to better align with required altitude sensitivity
        let simplifiedCoordinates = SpatialService.simplify(routeStatistics.points.map(p => [p.coordinate[0] * 100, p.coordinate[1]]), 5);
        let previousSimplifiedPoint = simplifiedCoordinates[0];
        for (let simplifiedPoint of simplifiedCoordinates) {
            routeStatistics.gain += ((simplifiedPoint[1] - previousSimplifiedPoint[1]) > 0 &&
                    simplifiedPoint[1] !== 0 &&
                    previousSimplifiedPoint[1] !== 0)
                ? (simplifiedPoint[1] - previousSimplifiedPoint[1])
                : 0;
            routeStatistics.loss += ((simplifiedPoint[1] - previousSimplifiedPoint[1]) < 0 &&
                    simplifiedPoint[1] !== 0 &&
                    previousSimplifiedPoint[1] !== 0)
                ? (simplifiedPoint[1] - previousSimplifiedPoint[1])
                : 0;
            previousSimplifiedPoint = simplifiedPoint;
        }
        return routeStatistics;
    }

    public getStatistics(route: RouteData,
                         closestRouteToRecording: RouteData,
                         latLng: ILatLngTime,
                         heading: number,
                         routeIsRecording: boolean): IRouteStatistics {
        let routeStatistics = this.getStatisticsByRange(route, null, null);
        let closestRouteStatistics = closestRouteToRecording ? this.getStatisticsByRange(closestRouteToRecording, null, null) : null;
        if (closestRouteStatistics == null) {
            this.addDurationAndAverageSpeed(route, routeStatistics.length, routeStatistics);
            return routeStatistics;
        }
        closestRouteStatistics.remainingDistance =
            closestRouteStatistics.length - (this.findDistanceForLatLngInKM(closestRouteStatistics, latLng, heading) * 1000);
        if (routeIsRecording) {
            this.addDurationAndAverageSpeed(route, routeStatistics.length, closestRouteStatistics);
            closestRouteStatistics.length = routeStatistics.length;
        } else {
            this.addDurationAndAverageSpeed(closestRouteToRecording, closestRouteStatistics.length, closestRouteStatistics);
            closestRouteStatistics.length = closestRouteStatistics.length - closestRouteStatistics.remainingDistance;
        }
        return closestRouteStatistics;
    }

    private addDurationAndAverageSpeed(route: RouteData, length: number, fullStatistics: IRouteStatistics) {
        if (route.segments.length === 0) {
            return;
        }
        let start = route.segments[0].latlngs[0];
        let end = last(last(route.segments).latlngs);
        if (start.timestamp != null && end.timestamp != null) {
            fullStatistics.duration = (new Date(end.timestamp).getTime() - new Date(start.timestamp).getTime()) / 1000;
            fullStatistics.averageSpeed = length / fullStatistics.duration * 3.6; // convert m/sec to km/hr
        }
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
            if (currentPoint.coordinate[0] < x) {
                previousPoint = currentPoint;
                continue;
            }
            if (currentPoint.coordinate[0] - previousPoint.coordinate[0] === 0) {
                previousPoint = currentPoint;
                continue;
            }
            let ratio = (x - previousPoint.coordinate[0]) / (currentPoint.coordinate[0] - previousPoint.coordinate[0]);
            let point = { coordinate: [x, 0] } as IRouteStatisticsPoint;
            point.coordinate[1] = this.getInterpolatedValue(previousPoint.coordinate[1], currentPoint.coordinate[1], ratio);
            point.slope = this.getInterpolatedValue(previousPoint.slope, currentPoint.slope, ratio);
            point.latlng = SpatialService.getLatlngInterpolatedValue(previousPoint.latlng, currentPoint.latlng, ratio, point.coordinate[1]);
            return point;
        }
        return previousPoint;
    }

    private getInterpolatedValue(value1: number, value2: number, ratio: number) {
        return (value2 - value1) * ratio + value1;
    }

    public findDistanceForLatLngInKM(statistics: IRouteStatistics, latLng: LatLngAlt, heading: number): number {
        if (statistics.points.length < 2) {
            return 0;
        }
        let bestPoint = null;
        let minimalWeight = MINIMAL_DISTANCE;
        if (heading != null) {
            minimalWeight += MINIMAL_ANGLE;
        }
        let previousPoint = statistics.points[0];
        for (let point of statistics.points) {
            if (point === statistics.points[0]) {
                continue;
            }
            let currentWeight = SpatialService.getDistanceFromPointToLine(latLng, [previousPoint.latlng, point.latlng]);
            if (heading != null) {
                currentWeight += Math.abs(heading - SpatialService.getLineBearingInDegrees(previousPoint.latlng, point.latlng));
            }
            if (currentWeight < minimalWeight) {
                minimalWeight = currentWeight;
                bestPoint = previousPoint;
            }
            previousPoint = point;
        }
        return bestPoint
            ? bestPoint.coordinate[0] + SpatialService.getDistanceInMeters(bestPoint.latlng, latLng) / 1000
            : 0;
    }
}
