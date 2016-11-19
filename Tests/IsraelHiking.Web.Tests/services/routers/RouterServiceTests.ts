/// <reference path="../../../../isrealhiking.web/services/parsers/GeoJsonParser.ts" />
/// <reference path="../../../../isrealhiking.web/services/routers/nonerouter.ts" />
/// <reference path="../../../../isrealhiking.web/services/routers/routerservice.ts" />

namespace IsraelHiking.Tests.Services.Routers {
    describe("Router Service", () => {
        const ADDRESS = Common.Urls.routing + "?from=1,1&to=2,2&type=Hike";
        var $q: angular.IQService;        
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var toastr: Toastr;
        var routeService: IsraelHiking.Services.Routers.RouterService;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.module("LocalStorageModule");
            angular.mock.module("gettext");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$q_: angular.IQService, _localStorageService_: angular.local.storage.ILocalStorageService, _gettextCatalog_: angular.gettext.gettextCatalog, _toastr_: Toastr) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                $q = _$q_;
                toastr = _toastr_;
                toastr.error = (): any => { };
                $httpBackend.whenGET(url => url.indexOf(Common.Urls.translations) !== -1).respond(404, {}); // ignore resources get request
                routeService = new IsraelHiking.Services.Routers.RouterService($http, $q, new IsraelHiking.Services.ResourcesService(null, _localStorageService_, _gettextCatalog_), toastr, new IsraelHiking.Services.Parsers.GeoJsonParser());
            });
            
        });

        it("Should route between two points", (done) => {
            $httpBackend.whenGET(ADDRESS).respond({ type:"FeatureCollection", features:[
                {
                    type: "Feature",
                    properties: {
                        name: "name"
                    },
                    geometry: {
                        type: "LineString",
                        coordinates: [[1,1] as GeoJSON.Position, [1.5,1.5], [2,2]]
                    } as GeoJSON.LineString
                } as GeoJSON.Feature<GeoJSON.LineString>
            ] } as GeoJSON.FeatureCollection<GeoJSON.GeometryObject>);
            routeService.getRoute(L.latLng(1, 1), L.latLng(2, 2), "Hike").then((data) => {
                expect(data.length).toBe(2);
                expect(data[1].latlngzs.length).toBe(3);
            }).finally(done);
            $httpBackend.flush();
        });

        it("Should use none router when reponse is not a geojson", (done) => {
            $httpBackend.whenGET(ADDRESS).respond({});
            routeService.getRoute(L.latLng(1, 1), L.latLng(2, 2), "Hike").then((data) => {
                expect(data.length).toBe(1);
                expect(data[0].latlngzs.length).toBe(2);
            }).finally(done);
            $httpBackend.flush();
        });

        it("Should use none router when getting error response from server", (done) => {
            $httpBackend.whenGET(ADDRESS).respond(500, {});
            routeService.getRoute(L.latLng(1, 1), L.latLng(2, 2), "Hike").then((data) => {
                expect(data.length).toBe(1);
                expect(data[0].latlngzs.length).toBe(2);
            }).finally(done);
            $httpBackend.flush();
        });
        
    });
}