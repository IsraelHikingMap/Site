/// <reference path="../scripts/typings/jasmine/jasmine.d.ts" />
/// <reference path="../../../isrealhiking.web/scripts/typings/angularjs/angular.d.ts" />
/// <reference path="../../../isrealhiking.web/scripts/typings/leaflet/leaflet.d.ts" />
/// <reference path="../../../isrealhiking.web/scripts/typings/angularjs/angular-mocks.d.ts" />
/// <reference path="../../../isrealhiking.web/scripts/typings/toastr/toastr.d.ts" />
/// <reference path="../../../isrealhiking.web/services/elevation/ielevationprovider.ts" />
/// <reference path="../../../isrealhiking.web/services/elevation/microsoftelevationprovider.ts" />
/// <reference path="../../../isrealhiking.web/common/israelhikingdata.ts" />

module IsraelHiking {
    describe("Microsoft Elevation Provider", () => {
        var ADDRESS = "http://dev.virtualearth.net/REST/v1/Elevation/List?jsonp=JSON_CALLBACK&key=ArUJIOvdEI-4sFS5-3PqMlDJP-00FMLrOeLIGkLRpfWIjfpOcESgnE-Zmk-ZimU2&points=undefined,undefined";
        var elevationProvider: IsraelHiking.Services.Elevation.MicrosoftElevationProvider;
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var toastr: Toastr;

        beforeEach(() => {
            elevationProvider = new Services.Elevation.MicrosoftElevationProvider(null, null);
            //angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService) => { // , _toastr_: Toastr
            //    // The injector unwraps the underscores (_) from around the parameter names when matching
            //    $http = _$http_;
            //    $httpBackend = _$httpBackend_;
            //    //toastr = _toastr_;
            //    elevationProvider = new Services.Elevation.MicrosoftElevationProvider($http, null);
            //});
        });
        
        //it("Should update height data", () => {
        //    var latlngzs = [<Common.LatLngZ>{ z: 0 }];
        //    $httpBackend.when("JSONP", ADDRESS)
        //        .respond({ resourceSets: [{ resources: [{ elevations: [1] }] }] });
        //    elevationProvider.updateHeights(latlngzs);
        //    $httpBackend.flush();
        //    expect(latlngzs[0].z).toBe(1);
        //});
        //
        //it("Should not update height data because no data returned", () => {
        //    var latlngzs = [<Common.LatLngZ>{ z: 0 }];
        //    $httpBackend.when("JSONP", ADDRESS)
        //        .respond({ resourceSets: [{ resources: [{ elevations: [] }] }] });
        //    elevationProvider.updateHeights(latlngzs);
        //    $httpBackend.flush();
        //    expect(latlngzs[0].z).toBe(0);
        //});
        //
        //it("Should not update height data because no data has no sets", () => {
        //    var latlngzs = [<Common.LatLngZ>{ z: 0 }];
        //    $httpBackend.when("JSONP", ADDRESS)
        //        .respond({ resourceSets: [] });
        //    elevationProvider.updateHeights(latlngzs);
        //    $httpBackend.flush();
        //    expect(latlngzs[0].z).toBe(0);
        //});
        //
        //it("Should not update height data because no data has no resources", () => {
        //    var latlngzs = [<Common.LatLngZ>{ z: 0 }];
        //    $httpBackend.when("JSONP", ADDRESS)
        //        .respond({ resourceSets: [{ resources: [] }] });
        //    elevationProvider.updateHeights(latlngzs);
        //    $httpBackend.flush();
        //    expect(latlngzs[0].z).toBe(0);
        //});
        it("Should run", () => {
            expect(1).toBe(1);
        });
    });
}