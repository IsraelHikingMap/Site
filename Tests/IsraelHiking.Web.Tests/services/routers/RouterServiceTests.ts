/// <reference path="../../../../isrealhiking.web/services/parsers/iparser.ts" />
/// <reference path="../../../../isrealhiking.web/services/parsers/baseparser.ts" />
/// <reference path="../../../../isrealhiking.web/services/routers/nonerouter.ts" />
/// <reference path="../../../../isrealhiking.web/services/routers/routerservice.ts" />

module IsraelHiking.Tests {
    describe("Router Service", () => {
        const ADDRESS = Common.Urls.routing + "?from=1,1&to=2,2&type=h";
        var $q: angular.IQService;        
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var $timeout;
        var toastr: Toastr;
        var routeService: Services.Routers.RouterService;

        beforeEach(() => {
            angular.mock.module("toastr");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$q_: angular.IQService, _$timeout_: angular.ITimeoutService, _toastr_: Toastr) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $httpBackend = _$httpBackend_;
                $q = _$q_;
                $timeout = _$timeout_;
                toastr = _toastr_;
                toastr.error = (): any => { };
                routeService = new Services.Routers.RouterService($http, $q, toastr, new Services.Parsers.ParserFactory());
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
                } as GeoJSON.Feature
            ] } as GeoJSON.FeatureCollection);
            routeService.getRoute(L.latLng(1, 1), L.latLng(2, 2), "h").then((data) => {
                expect(data.length).toBe(2);
                expect(data[1].latlngzs.length).toBe(3);
            }).finally(done);
            $httpBackend.flush();
        });

        it("Should use none router when reponse is not a geojson", (done) => {
            $httpBackend.whenGET(ADDRESS).respond({});
            routeService.getRoute(L.latLng(1, 1), L.latLng(2, 2), "h").then((data) => {
                expect(data.length).toBe(1);
                expect(data[0].latlngzs.length).toBe(2);
            }).finally(done);
            $httpBackend.flush();
        });

        it("Should use none router when getting error response from server", (done) => {
            $httpBackend.whenGET(ADDRESS).respond(500, {});
            routeService.getRoute(L.latLng(1, 1), L.latLng(2, 2), "h").then((data) => {
                expect(data.length).toBe(1);
                expect(data[0].latlngzs.length).toBe(2);
            }).finally(done);
            $httpBackend.flush();
        });
        
    });
}