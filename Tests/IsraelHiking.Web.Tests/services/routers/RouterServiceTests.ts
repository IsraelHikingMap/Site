/// <reference path="../../../../isrealhiking.web/services/parsers/iparser.ts" />
/// <reference path="../../../../isrealhiking.web/services/parsers/baseparser.ts" />
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
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$q_: angular.IQService, _toastr_: Toastr) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                $q = _$q_;
                toastr = _toastr_;
                toastr.error = (): any => { };
                routeService = new IsraelHiking.Services.Routers.RouterService($http, $q, toastr, new IsraelHiking.Services.Parsers.ParserFactory());
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