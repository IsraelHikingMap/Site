/// <reference path="../../../../isrealhiking.web/services/elevation/elevationprovider.ts" />
/// <reference path="../../../../isrealhiking.web/common/urls.ts" />

namespace IsraelHiking.Tests {
    describe("Elevation Provider", () => {
        var ADDRESS = Common.Urls.elevation + "?point=0.0000,0.0000";
        var elevationProvider: Services.Elevation.ElevationProvider;
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var toastr: Toastr;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _toastr_: Toastr) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                toastr = _toastr_;
                elevationProvider = new Services.Elevation.ElevationProvider($http, toastr);
            });
        });

        it("Should update height data", () => {
            var latlngzs = [<Common.LatLngZ>{ lat: 0, lng: 0, z: 0 }];
            $httpBackend.whenGET(ADDRESS).respond([1]);

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();

            expect(latlngzs[0].z).toBe(1);
        });

        it("Should not call provider bacause all coordinates has elevation", () => {
            var latlngzs = [<Common.LatLngZ>{ lat: 0, lng: 0, z: 1 }];

            elevationProvider.updateHeights(latlngzs);

            expect(latlngzs[0].z).toBe(1);
            $httpBackend.verifyNoOutstandingExpectation();
        });

        it("Should raise toast when error occurs", () => {
            var latlngzs = [<Common.LatLngZ>{ lat: 0, lng: 0, z: 0 }];
            $httpBackend.whenGET(ADDRESS).respond(500, {});
            toastr.error = jasmine.createSpy("spy");

            elevationProvider.updateHeights(latlngzs);
            $httpBackend.flush();

            expect(toastr.error).toHaveBeenCalled();
        });
    });
}