/// <reference path="../../../israelhiking.web/wwwroot/services/routestatisticsservice.ts" />

namespace IsraelHiking.Tests.Services {
    describe("Route Statistics Service", () => {
        var routeStatisticsSerivice: IsraelHiking.Services.RouteStatisticsService;

        beforeEach(() => {
            routeStatisticsSerivice = new IsraelHiking.Services.RouteStatisticsService();
        });

        it("Should initialize hidden", () => {
            expect(routeStatisticsSerivice.isVisible).toBe(false);
        });
        
        it("Should show when toggled", () => {
            routeStatisticsSerivice.toggle();

            expect(routeStatisticsSerivice.isVisible).toBe(true);
        });

        it("Should hide when double toggled", () => {
            routeStatisticsSerivice.toggle();
            routeStatisticsSerivice.toggle();

            expect(routeStatisticsSerivice.isVisible).toBe(false);
        });

        it("Should hide when toggled and then hide", () => {
            routeStatisticsSerivice.toggle();

            expect(routeStatisticsSerivice.isVisible).toBe(false);
        });
    });
}