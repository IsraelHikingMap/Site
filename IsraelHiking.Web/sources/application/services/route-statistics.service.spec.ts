import { RouteStatisticsService, IRouteStatistics, IRouteStatisticsPoint } from "./route-statistics.service";
import { RouteData } from "../models/models";

describe("RouteStatisticsService", () => {
    let service: RouteStatisticsService;

    beforeEach(() => {
        service = new RouteStatisticsService();
    });

    it("Should get empty statistics on empty route", () => {
        let routeData = {
            segments: []
        } as RouteData;

        let statistics = service.getStatistics(routeData, null);

        expect(statistics.gain).toBe(0);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).toBe(0);
        expect(statistics.points.length).toBe(0);
    });

    it("Should get statistics on route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 10, lng: 10, alt: 10 }, { lat: 20, lng: 20, alt: 20 }]
                },
                {
                    latlngs: [{ lat: 20, lng: 20, alt: 20 }, { lat: 30, lng: 30, alt: 30 }]
                },
                {
                    latlngs: [{ lat: 20, lng: 20, alt: 20 }, { lat: 10, lng: 10, alt: 10 }]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null);

        expect(statistics.gain).toBe(20);
        expect(statistics.loss).toBe(-20);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(5);
    });

    it("Should get simplified statistics on route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 1, lng: 1, alt: 1 }, { lat: 4, lng: 4, alt: 4 }]
                },
                {
                    latlngs: [{ lat: 4, lng: 4, alt: 4 }, { lat: 1, lng: 1, alt: 1 }]
                }
            ]
        } as RouteData;

        let statistics = service.getStatistics(routeData, null);

        expect(statistics.gain).toBe(0);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).not.toBe(0);
    });

    it("Should get statistics on part of route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [{ lat: 0, lng: 0, alt: 0 }, { lat: 0, lng: 0.01, alt: 2 }, { lat: 0, lng: 0.02, alt: 1 }]
                }
            ]
        } as RouteData;
        let statistics = service.getStatistics(routeData, null);
        let start = service.interpolateStatistics(statistics, 0.5);
        let end = service.interpolateStatistics(statistics, 1);
        statistics = service.getStatisticsByRange(routeData, start, end);

        expect(statistics.gain).toBeCloseTo(0.9, 2);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(2);
    });

    it("Should not interpolate statistics with less than 2 points", () => {
        let interpolated = service.interpolateStatistics({ points: [] } as IRouteStatistics, null);

        expect(interpolated).toBeNull();
    });

    it("Should interpolate statistics", () => {
        let interpolated = service.interpolateStatistics({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                } as IRouteStatisticsPoint,
                {
                    coordinate: [1, 1],
                    latlng: { lat: 1, lng: 1 }
                } as IRouteStatisticsPoint,
                {
                    coordinate: [2, 2],
                    latlng: { lat: 2, lng: 2 }
                } as IRouteStatisticsPoint,
                {
                    coordinate: [3, 3],
                    latlng: { lat: 3, lng: 3 }
                } as IRouteStatisticsPoint
            ]
        } as IRouteStatistics, 2.5);

        expect(interpolated.coordinate[1]).toBe(2.5);
        expect(interpolated.latlng.lat).toBe(2.5);
        expect(interpolated.latlng.lng).toBe(2.5);
    });

    it("Should return zero for statistics with less than 2 points", () => {
        let distance = service.findDistanceForLatLng({ points: [] } as IRouteStatistics, null);

        expect(distance).toBe(0);
    });

    it("Should not return 0 distance for statistics on route", () => {
        let distance = service.findDistanceForLatLng({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                },
                {
                    coordinate: [1, 1],
                    latlng: { lat: 1, lng: 1 }
                },
                {
                    coordinate: [2, 2],
                    latlng: { lat: 2, lng: 2 }
                },
                {
                    coordinate: [3, 3],
                    latlng: { lat: 3, lng: 3 }
                }
            ]
        } as IRouteStatistics, {lat: 0.6, lng: 0.6 });

        expect(distance).not.toBe(0);
    });

    it("Should return 0 distance for statistics not on route", () => {
        let distance = service.findDistanceForLatLng({
            points: [
                {
                    coordinate: [0, 0],
                    latlng: { lat: 0, lng: 0 }
                },
                {
                    coordinate: [1, 1],
                    latlng: { lat: 0.0001, lng: 0.0001 }
                },
                {
                    coordinate: [2, 2],
                    latlng: { lat: 0.0002, lng: 0.0002 }
                },
                {
                    coordinate: [3, 3],
                    latlng: { lat: 0.0003, lng: 0.0003 }
                }
            ]
        } as IRouteStatistics, {lat: 0.005, lng: 0.005 });

        expect(distance).toBe(0);
    });
});
