/// <reference path="../../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/scripts/typings/leaflet/leaflet.d.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/scripts/typings/angularjs/angular-mocks.d.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/scripts/typings/toastr/toastr.d.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/services/elevation/ielevationprovider.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/common/israelhiking.d.ts" />
/// <reference path="../../../../IsraelHiking.web/wwwroot/services/elevation/microsoftelevationprovider.ts" />


namespace IsraelHiking.Tests.Services.Elevation {
    export const address = "http://dev.virtualearth.net/REST/v1/Elevation/List?jsonp=JSON_CALLBACK&key=ArUJIOvdEI-4sFS5-3PqMlDJP-00FMLrOeLIGkLRpfWIjfpOcESgnE-Zmk-ZimU2&points=0.0000,0.0000";

    describe("Microsoft Elevation Provider", () => {
        var elevationProvider: IsraelHiking.Services.Elevation.MicrosoftElevationProvider;
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var toastr: Toastr;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.module("LocalStorageModule");
            angular.mock.module("gettext");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _localStorageService_: angular.local.storage.ILocalStorageService, _gettextCatalog_: angular.gettext.gettextCatalog, _toastr_: Toastr) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                toastr = _toastr_;
                $httpBackend.whenGET(url => url.indexOf(Common.Urls.translations) !== -1).respond(404, {}); // ignore resources get request
                elevationProvider = new IsraelHiking.Services.Elevation.MicrosoftElevationProvider($http, new IsraelHiking.Services.ResourcesService(null, _localStorageService_, _gettextCatalog_), toastr);
            });
        });
        
        it("Should update height data", () => {
            var latlngzs = [{lat: 0, lng: 0, z: 0 } as Common.LatLngZ];
            $httpBackend.whenJSONP(address).respond({ resourceSets: [{ resources: [{ elevations: [1] }] }] });

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();
        
            expect(latlngzs[0].z).toBe(1);
        });
        
        it("Should not update height data because no data returned", () => {
            var latlngzs = [{ lat: 0, lng: 0, z: 0 } as Common.LatLngZ];
            $httpBackend.whenJSONP(address).respond({ resourceSets: [{ resources: [{ elevations: [] }] }] });

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();
        
            expect(latlngzs[0].z).toBe(0);
        });
        
        it("Should not update height data because data has no sets", () => {
            var latlngzs = [{ lat: 0, lng: 0, z: 0 } as Common.LatLngZ];
            $httpBackend.whenJSONP(address).respond({ resourceSets: [] });

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();
        
            expect(latlngzs[0].z).toBe(0);
        });
        
        it("Should not update height data because data has no resources", () => {
            var latlngzs = [{ lat: 0, lng: 0, z: 0 } as Common.LatLngZ];
            $httpBackend.whenJSONP(address).respond({ resourceSets: [{ resources: [] }] });

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();
        
            expect(latlngzs[0].z).toBe(0);
        });
        
        it("Should not call provider bacause all coordinates has elevation", () => {
            var latlngzs = [{ lat: 0, lng: 0, z: 1 } as Common.LatLngZ];

            elevationProvider.updateHeights(latlngzs);
        
            expect(latlngzs[0].z).toBe(1);
            $httpBackend.verifyNoOutstandingExpectation();
        });

        it("Should raise toast when error occurs", () => {
            var latlngzs = [{ lat: 0, lng: 0, z: 0 } as Common.LatLngZ];
            $httpBackend.whenJSONP(address).respond(500, {});
            toastr.error = jasmine.createSpy("spy");

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();

            expect(toastr.error).toHaveBeenCalled();
        });
    });
}