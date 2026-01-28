import { Injectable } from "@angular/core";
import linearInterpolator from "linear-interpolator";
import type { Immutable } from "immer";

import { SpatialService } from "./spatial.service";
import type { LatLngAlt, LatLngAltTime } from "../models";

export const MINIMAL_DISTANCE = 50;
export const MINIMAL_ANGLE = 30;

export type RouteStatisticsPoint = {
    /**
     * x - distance in KM, y - altitude in meters
     */
    coordinate: [number, number];
    latlng: LatLngAlt;
    slope: number;
};

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
    /**
     * The distnace in meters traveled
     */
    traveledDistance: number;
};

@Injectable()
export class RouteStatisticsService {
    public getStatisticsByRange(latlngs: Immutable<LatLngAltTime[]>, start: RouteStatisticsPoint, end: RouteStatisticsPoint): RouteStatistics {
        const routeStatistics = {
            points: [] as RouteStatisticsPoint[],
            length: 0,
            gain: 0,
            loss: 0,
            remainingDistance: null,
            duration: null,
            averageSpeed: null
        } as RouteStatistics;
        if (latlngs.length <= 0) {
            return routeStatistics;
        }

        // convert to route statistic points
        let previousLatlng = latlngs[0];
        routeStatistics.points.push(start || { coordinate: [0, previousLatlng.alt], latlng: previousLatlng, slope: 0 });
        for (const latlng of latlngs) {
            const distance = SpatialService.getDistanceInMeters(previousLatlng, latlng);
            routeStatistics.length += distance;
            const point = {
                coordinate: [(routeStatistics.length / 1000), latlng.alt],
                latlng,
                slope: 0
            } as RouteStatisticsPoint;
            if (start == null || (point.coordinate[0] > start.coordinate[0] && point.coordinate[0] < end.coordinate[0])) {
                routeStatistics.points.push(point);
            }
            previousLatlng = latlng;
        }
        if (start != null && end != null) {
            routeStatistics.points.push(end);
            routeStatistics.length = (end.coordinate[0] - start.coordinate[0]) * 1000;
        }

        // filter invalid points for the rest of the calculations
        routeStatistics.points = routeStatistics.points.filter(p => !isNaN(p.latlng.alt) && p.latlng.alt != null);
        for (let pointIndex = routeStatistics.points.length - 1; pointIndex > 0; pointIndex--) {
            const prevPoint = routeStatistics.points[pointIndex - 1];
            const currentPoint = routeStatistics.points[pointIndex];
            if (currentPoint.coordinate[0] - prevPoint.coordinate[0] < 0.001) {
                routeStatistics.points.splice(pointIndex, 1);
            }
        }
        if (routeStatistics.points.length < 1) {
            return routeStatistics;
        }

        // calculate slope
        for (let pointIndex = 1; pointIndex < routeStatistics.points.length; pointIndex++) {
            const prevPoint = routeStatistics.points[pointIndex - 1];
            const currentPoint = routeStatistics.points[pointIndex];
            currentPoint.slope = (currentPoint.coordinate[1] - prevPoint.coordinate[1]) * 0.1 /
                (currentPoint.coordinate[0] - prevPoint.coordinate[0]);
        }

        this.updateGainAndLoss(routeStatistics);

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

    /**
     * Calculate total gain & loss using resampling and median filter
     *
     * @param routeStatistics - the statistic object to update
     */
    private updateGainAndLoss(routeStatistics: RouteStatistics) {
        // resample coordinates along route at uniform resolution
        const coordinates = routeStatistics.points.map(p => p.coordinate);
        const linterp = linearInterpolator(coordinates);
        const resamplingResolutionKm = 0.01;
        const interpolatedCoordinates = [];
        for (let x = coordinates[0][0]; x <= coordinates[coordinates.length - 1][0]; x += resamplingResolutionKm) {
            interpolatedCoordinates.push([x, linterp(x)]);
        }

        // pad interpolated coordinates towards applying moving median filter
        const medianFilterSize = 19;
        const halfMedianFilter = Math.floor(medianFilterSize / 2);
        let paddedInterpolatedCoordinates = [];
        for (let i = 0; i < halfMedianFilter; i++) {
            paddedInterpolatedCoordinates.push(interpolatedCoordinates[0]);
        }
        paddedInterpolatedCoordinates = paddedInterpolatedCoordinates.concat(interpolatedCoordinates);
        for (let i = 0; i < halfMedianFilter; i++) { paddedInterpolatedCoordinates.push(interpolatedCoordinates[interpolatedCoordinates.length - 1]); }

        // apply moving median filter to remove outliers
        const filteredCoordinates = [] as [number, number][];
        for (let i = halfMedianFilter; i < paddedInterpolatedCoordinates.length - halfMedianFilter; i++) {
            const sliceWindow = paddedInterpolatedCoordinates.slice(i - halfMedianFilter, i + halfMedianFilter + 1);
            filteredCoordinates.push([paddedInterpolatedCoordinates[i][0], this.median(sliceWindow.map(x => x[1]))]);
        }

        // compute total route gain & loss
        let previousFilteredCoordinate = filteredCoordinates[0];
        for (const filteredCoordinate of filteredCoordinates) {
            const elevationDiff = filteredCoordinate[1] - previousFilteredCoordinate[1];
            if (elevationDiff >= 0) {
                routeStatistics.gain += elevationDiff;
            } else {
                routeStatistics.loss += elevationDiff;
            }
            previousFilteredCoordinate = filteredCoordinate;
        }
    }

    public getStatisticsForStandAloneRoute(latlngs: Immutable<LatLngAltTime[]>): RouteStatistics {
        const routeStatistics = this.getStatisticsByRange(latlngs, null, null);
        this.addDurationAndAverageSpeed(latlngs, routeStatistics.length, routeStatistics);
        return routeStatistics;
    }

    public getStatisticsForRouteWithLocation(
        closestRouteToRecordingLatlngs: LatLngAltTime[],
        currentLatlng: LatLngAltTime,
        heading: number
    ): RouteStatistics {
        const closestRouteStatistics = this.getStatisticsByRange(closestRouteToRecordingLatlngs, null, null);
        closestRouteStatistics.traveledDistance = (this.findDistanceForLatLngInKM(closestRouteStatistics, currentLatlng, heading) * 1000);
        closestRouteStatistics.remainingDistance = closestRouteStatistics.length - closestRouteStatistics.traveledDistance;
        this.addDurationAndAverageSpeed(closestRouteToRecordingLatlngs, closestRouteStatistics.length, closestRouteStatistics);
        return closestRouteStatistics;
    }

    public getStatisticsForRecordedRouteWithPlannedRoute(recordedRouteLatlngs: Immutable<LatLngAltTime[]>,
        closestRouteToRecordingLatlngs: LatLngAltTime[],
        currentLatlng: LatLngAltTime,
        heading: number) {
        const recordedRouteStatistics = this.getStatisticsByRange(recordedRouteLatlngs, null, null);
        const closestRouteStatistics = this.getStatisticsByRange(closestRouteToRecordingLatlngs, null, null);
        closestRouteStatistics.remainingDistance =
            closestRouteStatistics.length - (this.findDistanceForLatLngInKM(closestRouteStatistics, currentLatlng, heading) * 1000);
        this.addDurationAndAverageSpeed(recordedRouteLatlngs, recordedRouteStatistics.length, closestRouteStatistics);
        closestRouteStatistics.traveledDistance = recordedRouteStatistics.length;
        return closestRouteStatistics;
    }

    private addDurationAndAverageSpeed(latlngs: Immutable<LatLngAltTime[]>, length: number, fullStatistics: RouteStatistics) {
        if (latlngs.length === 0) {
            return;
        }
        const start = latlngs[0];
        const end = latlngs[latlngs.length - 1];
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
        for (const currentPoint of statistics.points) {
            if (currentPoint.coordinate[0] < x) {
                previousPoint = currentPoint;
                continue;
            }
            if (currentPoint.coordinate[0] - previousPoint.coordinate[0] === 0) {
                previousPoint = currentPoint;
                continue;
            }
            const ratio = (x - previousPoint.coordinate[0]) / (currentPoint.coordinate[0] - previousPoint.coordinate[0]);
            const alt = SpatialService.getInterpolatedValue(previousPoint.coordinate[1], currentPoint.coordinate[1], ratio);
            const point: RouteStatisticsPoint = {
                coordinate: [x, alt],
                slope: SpatialService.getInterpolatedValue(previousPoint.slope, currentPoint.slope, ratio),
                latlng: SpatialService.getLatlngInterpolatedValue(previousPoint.latlng, currentPoint.latlng, ratio)
            };
            point.latlng.alt = alt;
            return point;
        }
        return previousPoint;
    }

    public findDistanceForLatLngInKM(statistics: RouteStatistics, latLng: LatLngAlt, heading: number): number {
        if (statistics.points.length < 2) {
            return 0;
        }
        let bestPoint = this.findDistanceForLatLngInKMInternal(statistics, latLng, heading);
        if (bestPoint == null && heading != null) {
            bestPoint = this.findDistanceForLatLngInKMInternal(statistics, latLng, null);
        }
        return bestPoint
            ? bestPoint.coordinate[0] + SpatialService.getDistanceInMeters(bestPoint.latlng, latLng) / 1000
            : 0;
    }

    private findDistanceForLatLngInKMInternal(statistics: RouteStatistics, latLng: LatLngAlt, heading: number): RouteStatisticsPoint {
        let bestPoint = null;
        let minimalWeight = MINIMAL_DISTANCE;
        if (heading != null) {
            minimalWeight += MINIMAL_ANGLE;
        }
        let previousPoint = statistics.points[0];
        for (const point of statistics.points) {
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
        return bestPoint;
    }
}
