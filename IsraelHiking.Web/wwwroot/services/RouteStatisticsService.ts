namespace IsraelHiking.Services {

    export interface IRouteStatisticsPoint extends L.Point {
        latlngz: Common.LatLngZ;
        slope: number;
    }

    export interface IRouteStatistics {
        points: IRouteStatisticsPoint[];
        length: number; // [meters]
        gain: number; // [meters] - adding only when going up hill.
        loss: number; // [meters] - adding only when going downhill - should be negative number.
    }

    export class RouteStatisticsService {
        public isVisible: boolean;

        constructor() {
            this.isVisible = false;
        }

        public toggle = () => {
            if (this.isVisible) {
                this.isVisible = false;
                return;
            }
            this.isVisible = true;
        }

        public getStatistics = (route: Common.RouteData): IRouteStatistics => {
            var routeStatistics = {
                points: [] as IRouteStatisticsPoint[],
                length: 0,
                gain: 0,
                loss: 0
            } as IRouteStatistics;
            if (route.segments.length <= 0) {
                return routeStatistics;
            }

            let previousPoint = route.segments[0].latlngzs[0];
            let point = L.point(0, previousPoint.z) as IRouteStatisticsPoint;
            point.latlngz = previousPoint;
            point.slope = 0;
            routeStatistics.points.push(point);

            for (let segment of route.segments) {
                for (let latlngz of segment.latlngzs) {
                    let distance = previousPoint.distanceTo(latlngz);
                    if (distance < 1) {
                        continue;
                    }
                    routeStatistics.length += distance;
                    let point = L.point((routeStatistics.length / 1000), latlngz.z) as IRouteStatisticsPoint;
                    point.latlngz = latlngz;
                    point.slope = distance === 0 ? 0 : (latlngz.z - previousPoint.z) * 100 / distance;
                    routeStatistics.points.push(point);
                    previousPoint = latlngz;
                }
            }
            let simplified = L.LineUtil.simplify(routeStatistics.points, 1);
            let previousSimplifiedPoint = simplified[0];
            for (let point of simplified) {
                routeStatistics.gain += ((point.y - previousSimplifiedPoint.y) > 0 && point.y !== 0 && previousSimplifiedPoint.y !== 0) ?
                    (point.y - previousSimplifiedPoint.y) :
                    0;
                routeStatistics.loss += ((point.y - previousSimplifiedPoint.y) < 0 && point.y !== 0 && previousSimplifiedPoint.y !== 0) ?
                    (point.y - previousSimplifiedPoint.y) :
                    0;
                previousSimplifiedPoint = point;
            }
            return routeStatistics;
        }

        public interpolateStatistics(statistics: IRouteStatistics, x: number) {
            if (statistics.points.length < 2) {
                return null;
            }
            let previousPoint = statistics.points[0];
            for (let currentPoint of statistics.points) {
                if (currentPoint.x < x) {
                    previousPoint = currentPoint;
                    continue;
                }
                let point = { x: x } as IRouteStatisticsPoint;
                point.y = this.getInterpolatedValue(previousPoint, currentPoint, x);

                let distance = x - previousPoint.x;
                point.slope = distance === 0 ? 0 : (point.y - previousPoint.y) * 100 / (distance * 1000);
                let ratio = distance / (currentPoint.x - previousPoint.x)
                point.latlngz = this.getLatlngInterpolatedValue(previousPoint.latlngz, currentPoint.latlngz, ratio, point.y);
                return point;
            }
            return previousPoint;
        }

        private getInterpolatedValue(point1: L.Point, point2: L.Point, x: number): number {
            return (point2.y - point1.y) / (point2.x - point1.x) * (x - point1.x) + point1.y;
        }

        private getLatlngInterpolatedValue(latlng1: L.LatLng, latlng2: L.LatLng, ratio: number, z: number): Common.LatLngZ {
            let returnValue = L.latLng((latlng2.lat - latlng1.lat) * ratio + latlng1.lat, (latlng2.lng - latlng1.lng) * ratio + latlng1.lng) as Common.LatLngZ;
            returnValue.z = z;
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
            let distance = L.LineUtil.pointToSegmentDistance(L.point(latlng1.lng, latlng1.lat), L.point(latlng2.lng, latlng2.lat), L.point(latlng.lng, latlng.lat));
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
                if (this.isOnSegment(previousPoint.latlngz, currentPoint.latlngz, latLng) == false) {
                    previousPoint = currentPoint;
                    continue;
                }
                return previousPoint.x + previousPoint.latlngz.distanceTo(latLng) / 1000;
            }
            return 0;
        }
    }
}