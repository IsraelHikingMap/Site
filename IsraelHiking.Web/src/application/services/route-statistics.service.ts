import { Injectable } from "@angular/core";
import { last } from "lodash-es";
import createMedianFilter from "moving-median";
import linearInterpolator from "linear-interpolator";
import { SpatialService } from "./spatial.service";
import type { LatLngAlt, RouteData, LatLngAltTime } from "../models/models";

export const MINIMAL_DISTANCE = 50;
export const MINIMAL_ANGLE = 30;

export type RouteStatisticsPoint = {
    /**
     * x - distance in KM, y - altitude in meters
     */
    coordinate: [number, number];
    latlng: LatLngAlt;
    slope: number;
}

export type RouteStatistics = {
    points: RouteStatisticsPoint[];
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
    public getStatisticsByRange(route: RouteData, start: RouteStatisticsPoint, end: RouteStatisticsPoint): RouteStatistics {
        let routeStatistics = {
            points: [] as RouteStatisticsPoint[],
            length: 0,
            gain: 0,
            loss: 0,
            remainingDistance: null,
            duration: null,
            averageSpeed: null
        } as RouteStatistics;
        if (route.segments.length <= 0) {
            return routeStatistics;
        }

        // convert to route statistic points
        let previousLatlng = route.segments[0].latlngs[0];
        routeStatistics.points.push(start || { coordinate: [0, previousLatlng.alt], latlng: previousLatlng, slope: 0 });
        for (let segment of route.segments) {
            for (let latlng of segment.latlngs) {
                let distance = SpatialService.getDistanceInMeters(previousLatlng, latlng);
                routeStatistics.length += distance;
                let point = {
                    coordinate: [(routeStatistics.length / 1000), latlng.alt],
                    latlng,
                    slope: 0
                } as RouteStatisticsPoint;
                if (start == null || (point.coordinate[0] > start.coordinate[0] && point.coordinate[0] < end.coordinate[0])) {
                    routeStatistics.points.push(point);
                }
                previousLatlng = latlng;
            }
        }
        if (start != null && end != null) {
            routeStatistics.points.push(end);
            routeStatistics.length = (end.coordinate[0] - start.coordinate[0]) * 1000;
        }

        // filter invalid points for the rest of the calculations
        routeStatistics.points = routeStatistics.points.filter(p => !isNaN(p.latlng.alt) && p.latlng.alt != null);
        for (let pointIndex = routeStatistics.points.length - 1; pointIndex > 0; pointIndex--) {
            let prevPoint = routeStatistics.points[pointIndex - 1];
            let currentPoint = routeStatistics.points[pointIndex];
            if (currentPoint.coordinate[0] - prevPoint.coordinate[0] < 0.001) {
                routeStatistics.points.splice(pointIndex, 1);
            }
        }
        if (routeStatistics.points.length < 1) {
            return routeStatistics;
        }

        // calculate slope
        for (let pointIndex = 1; pointIndex < routeStatistics.points.length; pointIndex++) {
            let prevPoint = routeStatistics.points[pointIndex - 1];
            let currentPoint = routeStatistics.points[pointIndex];
            currentPoint.slope = (currentPoint.coordinate[1] - prevPoint.coordinate[1]) * 0.1 /
                (currentPoint.coordinate[0] - prevPoint.coordinate[0]);
        }

	    // calculate total gain & loss:
        // resample coordinates along route at uniform resolution
        let coordinates = routeStatistics.points.map(p => p.coordinate);
        let linterp = linearInterpolator(coordinates);
        let resampling_resolution_km = 0.01;
        var interpolatedCoordinates = [];
        for (let x = coordinates[0][0]; x <= coordinates[coordinates.length-1][0]; x += resampling_resolution_km) {
            interpolatedCoordinates.push([x, linterp(x)]);
        }
                
        // pad interpolated coordinates towards applying moving median filter
        let median_filter_size = 19
        let half_median_filter = Math.floor(median_filter_size/2)
        let paddedInterpolatedCoordinates = []
        for (let i = 0; i < half_median_filter; i++)
            paddedInterpolatedCoordinates.push(interpolatedCoordinates[0]);
        paddedInterpolatedCoordinates = paddedInterpolatedCoordinates.concat(interpolatedCoordinates);
        for (let i = 0; i < half_median_filter; i++)
            paddedInterpolatedCoordinates.push(interpolatedCoordinates[interpolatedCoordinates.length-1]);
        
        // apply moving median filter to remove outliers
        let filteredCoordinates = []
        for (let i = half_median_filter; i < paddedInterpolatedCoordinates.length-half_median_filter; i++)
        {
            let window = paddedInterpolatedCoordinates.slice(i-half_median_filter, i+half_median_filter+1);
            filteredCoordinates.push([paddedInterpolatedCoordinates[i][0], this.median(window.map(x => x[1]))])
        }

        // compute total route gain & loss
        let previousFilteredCoordinate = filteredCoordinates[0];
        for (let filteredCoordinate of filteredCoordinates) {
            let elevationDiff = filteredCoordinate[1] - previousFilteredCoordinate[1]
            if (elevationDiff >= 0)
                routeStatistics.gain += elevationDiff
            else
                routeStatistics.loss += elevationDiff
            previousFilteredCoordinate = filteredCoordinate;
        }

        return routeStatistics;
    }

    private median(numbers: any[]) {
        const sorted = numbers.slice().sort((a, b) => a - b);
        const middle = Math.floor(sorted.length / 2);
        if (sorted.length % 2 === 0) {
            return (sorted[middle - 1] + sorted[middle]) / 2;
        }
        return sorted[middle];
    }

    public getStatistics(route: RouteData,
                         closestRouteToRecording: RouteData,
                         latLng: LatLngAltTime,
                         heading: number,
                         routeIsRecording: boolean): RouteStatistics {
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

    private addDurationAndAverageSpeed(route: RouteData, length: number, fullStatistics: RouteStatistics) {
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

    public interpolateStatistics(statistics: RouteStatistics, x: number) {
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
            let point = { coordinate: [x, 0] } as RouteStatisticsPoint;
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

    public findDistanceForLatLngInKM(statistics: RouteStatistics, latLng: LatLngAlt, heading: number): number {
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
