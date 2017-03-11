/// <reference path="../../../IsraelHiking.web/scripts/typings/angular-local-storage/angular-local-storage.d.ts" />
/// <reference path="../../../IsraelHiking.web/services/hashservice.ts" />

namespace IsraelHiking.Tests.Services {
    describe("Hash Service", () => {
        var $location: angular.ILocationService;
        var $window: angular.IWindowService;
        var $rootScope: angular.IScope;
        var localStorageService: angular.local.storage.ILocalStorageService;
        var hashService: IsraelHiking.Services.HashService;

        beforeEach(() => {
            angular.mock.module("LocalStorageModule");
            angular.mock.inject((_$location_: angular.ILocationService, _$window_: angular.IWindowService, _$rootScope_: angular.IScope, _localStorageService_: angular.local.storage.ILocalStorageService) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $location = _$location_;
                $window = _$window_;
                $rootScope = _$rootScope_;
                localStorageService = _localStorageService_;
            });
        });

        it("Should initialize without any data", () => {
            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            expect(hashService.latlng.lat).toBe(31.773);
            expect(hashService.latlng.lng).toBe(35.12);
            expect(hashService.zoom).toBe(13);
        });
        
        it("Should initialize location data", () => {
            spyOn($location, "path").and.returnValue("#/1/2/3");

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            expect(hashService.latlng.lat).toBe(2);
            expect(hashService.latlng.lng).toBe(3);
            expect(hashService.zoom).toBe(1);
        });

        it("Should initialize markers from search", () => {
            $location.search({markers: "1,1,title;2,2"});

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes[0].markers.length).toBe(2);
            expect(dataContainer.routes[0].markers[0].title).toBe("title");
            expect(dataContainer.routes[0].markers[1].latlng.lat).toBe(2);
        });

        it("Should be tolerant to points with single coordinate in search", () => {
            $location.search({ markers: "1;2,2" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes[0].markers.length).toBe(1);
            expect(dataContainer.routes[0].markers[0].latlng.lat).toBe(2);
        });

        it("Should initialize a routes from search", () => {
            $location.search({ route_1: "h,1,2;b,3,4", route2: "f,5,6:n,7,8" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes.length).toBe(2);
            expect(dataContainer.routes[0].name).toBe("route 1");
            expect(dataContainer.routes[0].segments[0].routePoint.lat).toBe(1);
            expect(dataContainer.routes[0].segments[0].routingType).toBe("Hike");
            expect(dataContainer.routes[0].segments[1].routePoint.lng).toBe(4);
            expect(dataContainer.routes[0].segments[1].routingType).toBe("Bike");
            expect(dataContainer.routes[1].name).toBe("route2");
            expect(dataContainer.routes[1].segments[0].routePoint.lng).toBe(6);
            expect(dataContainer.routes[1].segments[0].routingType).toBe("4WD");
            expect(dataContainer.routes[1].segments[1].routePoint.lat).toBe(7);
            expect(dataContainer.routes[1].segments[1].routingType).toBe("None");
        });

        it("Should initialize markers and routes from search", () => {
            $location.search({ markers: "1,1,title;2,2", route_1: "?,1,2;b,3,4" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes[0].name).toBe("route 1");
            expect(dataContainer.routes[0].segments[0].routePoint.lng).toBe(2);
            expect(dataContainer.routes[0].segments[0].routingType).toBe("Hike");
            expect(dataContainer.routes[0].segments[1].routePoint.lat).toBe(3);
            expect(dataContainer.routes[0].markers.length).toBe(2);
            expect(dataContainer.routes[0].markers[0].title).toBe("title");
            expect(dataContainer.routes[0].markers[1].latlng.lat).toBe(2);
        });

        it("Should initialize a baselayer address from search", () => {
            $location.search({ baselayer: "www.layer.com" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.baseLayer.address).toBe("www.layer.com");
            expect(dataContainer.baseLayer.key).toBe("");
        });

        it("Should initialize a baselayer key from search", () => {
            $location.search({ baselayer: "Israel_Hiking_Map" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.baseLayer.key).toBe("Israel Hiking Map");
            expect(dataContainer.baseLayer.address).toBe("");
        });

        it("Should handle empty object in search", () => {
            $location.search({});

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.baseLayer).toBeUndefined();
            expect(dataContainer.routes.length).toBe(0);
        });

        it("Should inialize siteUrl from search", () => {
            $location.search({ s: "siteUrl" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            expect(hashService.siteUrl).toBe("siteUrl");
        });

        it("Should be cleared when siteUrl is given", () => {
            $location.search({ s: "siteUrl", route1: "h,1,1"});

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);
            hashService.clear();

            expect($location.search()).toEqual({ s: "siteUrl" });
        });

        it("Should be cleared when siteUrl is not given", () => {
            $location.search({ route1: "h,1,1" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);
            hashService.clear();

            expect($location.search()).toEqual({});
        });

        it("Should ignore url for external file", () => {
            $location.search({ url: "external.file" });

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes.length).toEqual(0);
        });

        it("Should update url with location", () => {
            spyOn($rootScope, "$$phase").and.returnValue(false);

            hashService = new IsraelHiking.Services.HashService($location, $window, $rootScope, localStorageService);
            hashService.updateLocation(L.latLng(1, 2), 3);

            expect(hashService.latlng.lat).toBe(1);
            expect(hashService.latlng.lng).toBe(2);
            expect(hashService.zoom).toBe(3);
        });
    });
}