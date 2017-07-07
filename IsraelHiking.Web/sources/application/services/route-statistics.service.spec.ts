import { RouteStatisticsService, IRouteStatistics, IRouteStatisticsPoint } from "./RouteStatisticsService";
import * as Common from "../common/IsraelHiking";

describe("RouteStatisticsService", () => {
    var service: RouteStatisticsService;

    beforeEach(() => {
        service = new RouteStatisticsService();
    });

    it("Should be hidden when initialized", () => {
        expect(service.isVisible()).toBeFalsy();
    });

    it("Should be visible when toggled", () => {
        service.toggle();

        expect(service.isVisible()).toBeTruthy();
    });

    it("Should get empty statistics on empty route", () => {
        let routeData = {
            segments: []
        } as Common.RouteData;

        let statistics = service.getStatistics(routeData);

        expect(statistics.gain).toBe(0);
        expect(statistics.loss).toBe(0);
        expect(statistics.length).toBe(0);
        expect(statistics.points.length).toBe(0);
    });

    it("Should get statistics on route", () => {
        let routeData = {
            segments: [
                {
                    latlngs: [L.latLng(1, 1, 1), L.latLng(2, 2, 2)]
                },
                {
                    latlngs: [L.latLng(2, 2, 2), L.latLng(3, 3, 3)]
                },
                {
                    latlngs: [L.latLng(2, 2, 2), L.latLng(1, 1, 1)]
                },
            ]
        } as Common.RouteData;

        let statistics = service.getStatistics(routeData);

        expect(statistics.gain).toBe(2);
        expect(statistics.loss).toBe(-2);
        expect(statistics.length).not.toBe(0);
        expect(statistics.points.length).toBe(5);
    });

    it("Should not interpolate statistics with less than 2 points", () => {
        let interpolated = service.interpolateStatistics({ points: [] } as IRouteStatistics, null);

        expect(interpolated).toBeNull();
    });

    it("Should interpolate statistics", () => {
        let interpolated = service.interpolateStatistics({
            points: [
                {
                    x: 0,
                    y: 0,
                    latlng: L.latLng(0,0)
                } as IRouteStatisticsPoint,
                {
                    x: 1,
                    y: 1,
                    latlng: L.latLng(1, 1)
                } as IRouteStatisticsPoint,
                {
                    x: 2,
                    y: 2,
                    latlng: L.latLng(2, 2)
                } as IRouteStatisticsPoint,
                {
                    x: 3,
                    y: 3,
                    latlng: L.latLng(3, 3)
                } as IRouteStatisticsPoint,
            ]
        } as IRouteStatistics, 2.5);

        expect(interpolated.y).toBe(2.5);
        expect(interpolated.latlng.lat).toBe(2.5);
        expect(interpolated.latlng.lng).toBe(2.5);
    });

    it("Should return zero for statistics with less than 2 points", () => {
        let distance = service.findDistanceForLatLng({ points: [] } as IRouteStatistics, null);

        expect(distance).toBe(0);
    });

    it("Should return 0 distance for statistics not on route", () => {
        let distance = service.findDistanceForLatLng({
            points: [
                {
                    x: 0,
                    latlng: L.latLng(0,0)
                },
                {
                    x: 1,
                    latlng: L.latLng(1, 1)
                },
                {
                    x: 2,
                    latlng: L.latLng(2, 2)
                },
                {
                    x: 3,
                    latlng: L.latLng(3, 3)
                },
            ]
        } as IRouteStatistics, L.latLng(0.5, 0.6));

        expect(distance).toBe(0);
    });

    it("Should return 0 distance for statistics not on route", () => {
        let distance = service.findDistanceForLatLng({
            points: [
                {
                    x: 0,
                    latlng: L.latLng(0, 0)
                },
                {
                    x: 1,
                    latlng: L.latLng(0.0001, 0.0001)
                },
                {
                    x: 2,
                    latlng: L.latLng(0.0002, 0.0002)
                },
                {
                    x: 3,
                    latlng: L.latLng(0.0003, 0.0003)
                },
            ]
        } as IRouteStatistics, L.latLng(0.00005, 0.00005));

        expect(distance).not.toBe(0);
    });
});