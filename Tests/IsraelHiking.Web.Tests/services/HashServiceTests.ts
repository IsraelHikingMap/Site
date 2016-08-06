/// <reference path="../../../isrealhiking.web/scripts/typings/angular-local-storage/angular-local-storage.d.ts" />
/// <reference path="../../../isrealhiking.web/services/hashservice.ts" />

namespace IsraelHiking.Tests {
    describe("Hash Service", () => {
        var $location: angular.ILocationService;        
        var $rootScope: angular.IScope;
        var localStorageService: angular.local.storage.ILocalStorageService;
        var hashService: Services.HashService;

        beforeEach(() => {
            angular.mock.module("LocalStorageModule");
            angular.mock.inject((_$location_: angular.ILocationService, _$rootScope_: angular.IScope, _localStorageService_: angular.local.storage.ILocalStorageService) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $location = _$location_;
                $rootScope = _$rootScope_;
                localStorageService = _localStorageService_;
            });
        });

        it("Should initialize without any data", () => {
            hashService = new Services.HashService($location, $rootScope, localStorageService);

            expect(hashService.latlng.lat).toBe(31.773);
            expect(hashService.latlng.lng).toBe(35.12);
            expect(hashService.zoom).toBe(13);
        });
        
        it("Should initialize location data", () => {
            spyOn($location, "path").and.returnValue("#/1/2/3");

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            expect(hashService.latlng.lat).toBe(2);
            expect(hashService.latlng.lng).toBe(3);
            expect(hashService.zoom).toBe(1);
        });

        it("Should initialize markers from search", () => {
            $location.search({markers: "1,1,title;2,2"});

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.markers.length).toBe(2);
            expect(dataContainer.markers[0].title).toBe("title");
            expect(dataContainer.markers[1].latlng.lat).toBe(2);
        });

        it("Should be tolerant to points with single coordinate in search", () => {
            $location.search({ markers: "1;2,2" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.markers.length).toBe(1);
            expect(dataContainer.markers[0].latlng.lat).toBe(2);
        });

        it("Should initialize a routes from search", () => {
            $location.search({ route_1: "h,1,2;b,3,4", route2: "h,5,6:f,7,8" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes.length).toBe(2);
            expect(dataContainer.routes[0].name).toBe("route 1");
            expect(dataContainer.routes[0].segments[0].routePoint.lat).toBe(1);
            expect(dataContainer.routes[0].segments[1].routePoint.lng).toBe(4);
            expect(dataContainer.routes[1].name).toBe("route2");
            expect(dataContainer.routes[1].segments[0].routePoint.lng).toBe(6);
            expect(dataContainer.routes[1].segments[1].routePoint.lat).toBe(7);
        });

        it("Should initialize markers and routes from search", () => {
            $location.search({ markers: "1,1,title;2,2", route_1: "h,1,2;b,3,4" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.routes[0].name).toBe("route 1");
            expect(dataContainer.routes[0].segments[0].routePoint.lng).toBe(2);
            expect(dataContainer.routes[0].segments[1].routePoint.lat).toBe(3);
            expect(dataContainer.markers.length).toBe(2);
            expect(dataContainer.markers[0].title).toBe("title");
            expect(dataContainer.markers[1].latlng.lat).toBe(2);
        });

        it("Should initialize a baselayer address from search", () => {
            $location.search({ baselayer: "www.layer.com" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.baseLayer.address).toBe("www.layer.com");
            expect(dataContainer.baseLayer.key).toBe("");
        });

        it("Should initialize a baselayer key from search", () => {
            $location.search({ baselayer: "Israel_Hiking_Map" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.baseLayer.key).toBe("Israel Hiking Map");
            expect(dataContainer.baseLayer.address).toBe("");
        });

        it("Should handle empty object in search", () => {
            $location.search({});

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            let dataContainer = hashService.getDataContainer();
            expect(dataContainer.baseLayer).toBeUndefined();
            expect(dataContainer.routes.length).toBe(0);
        });

        it("Should inialize siteUrl from search", () => {
            $location.search({ s: "siteUrl" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);

            expect(hashService.siteUrl).toBe("siteUrl");
        });

        it("Should be cleared when siteUrl is given", () => {
            $location.search({ s: "siteUrl", route1: "h,1,1"});

            hashService = new Services.HashService($location, $rootScope, localStorageService);
            hashService.clear();

            expect($location.search()).toEqual({ s: "siteUrl" });
        });

        it("Should be cleared when siteUrl is not given", () => {
            $location.search({ route1: "h,1,1" });

            hashService = new Services.HashService($location, $rootScope, localStorageService);
            hashService.clear();

            expect($location.search()).toEqual({});
        });

        it("Should update url with location", () => {
            spyOn($rootScope, "$$phase").and.returnValue(false);

            hashService = new Services.HashService($location, $rootScope, localStorageService);
            hashService.updateLocation(L.latLng(1, 2), 3);

            expect(hashService.latlng.lat).toBe(1);
            expect(hashService.latlng.lng).toBe(2);
            expect(hashService.zoom).toBe(3);
        });
    });
}