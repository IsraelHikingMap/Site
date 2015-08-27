/// <reference path="../../isrealhiking.web/services/heightservice.ts" />
/// <reference path="../../isrealhiking.web/common/israelhikingdata.ts" />
/// <reference path="../scripts/typings/leaflet/leaflet.d.ts" />
/// <chutzpah_reference path="../../isrealhiking.web/scripts/angular.js" />
/// <chutzpah_reference path="../../isrealhiking.web/scripts/angular-mocks.js" />
/// <chutzpah_reference path="../../isrealhiking.web/scripts/leaflet-0.7.3.js" />
/// <chutzpah_reference path="../../isrealhiking.web/services/heightservice.js" />

module IsraelHiking {
    describe("Height Service", () => {
        var ADDRESS = "http://dev.virtualearth.net/REST/v1/Elevation/List?jsonp=JSON_CALLBACK&key=ArUJIOvdEI-4sFS5-3PqMlDJP-00FMLrOeLIGkLRpfWIjfpOcESgnE-Zmk-ZimU2&points=undefined,undefined,1,1";
        var heightService: IsraelHiking.Services.HeightService;
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;

        beforeEach(angular.mock.inject((_$http_, _$httpBackend_: angular.IHttpBackendService) => {
            // The injector unwraps the underscores (_) from around the parameter names when matching
            $http = _$http_;
            $httpBackend = _$httpBackend_;
            heightService = new Services.HeightService($http);
        }));

        it("Should update height data", () => {
            var latlngzs = [<Common.LatLngZ>{ z: 0 }];
            $httpBackend.when("JSONP", ADDRESS)
                .respond({ resourceSets: [{ resources: [{ elevations: [1] }] }] });
            heightService.updateHeights(latlngzs);
            $httpBackend.flush();
            expect(latlngzs[0].z).toBe(1);
        });

        it("Should not update height data because no data returned", () => {
            var latlngzs = [<Common.LatLngZ>{ z: 0 }];
            $httpBackend.when("JSONP", ADDRESS)
                .respond({ resourceSets: [{ resources: [{ elevations: [] }] }] });
            heightService.updateHeights(latlngzs);
            $httpBackend.flush();
            expect(latlngzs[0].z).toBe(0);
        });

        it("Should not update height data because no data has no sets", () => {
            var latlngzs = [<Common.LatLngZ>{ z: 0 }];
            $httpBackend.when("JSONP", ADDRESS)
                .respond({ resourceSets: [] });
            heightService.updateHeights(latlngzs);
            $httpBackend.flush();
            expect(latlngzs[0].z).toBe(0);
        });

        it("Should not update height data because no data has no resources", () => {
            var latlngzs = [<Common.LatLngZ>{ z: 0 }];
            $httpBackend.when("JSONP", ADDRESS)
                .respond({ resourceSets: [{ resources: [] }] });
            heightService.updateHeights(latlngzs);
            $httpBackend.flush();
            expect(latlngzs[0].z).toBe(0);
        });
    });
}