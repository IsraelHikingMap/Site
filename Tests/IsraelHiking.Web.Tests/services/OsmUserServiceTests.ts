/// <reference path="../../../israelhiking.web/wwwroot/services/OsmUserService.ts" />

namespace IsraelHiking.Tests.Services {
    describe("OSM User Service", () => {
        var x2Js = new X2JS();
        var userDetailsResponse = x2Js.parseXmlString(
            "<?xml version='1.0' encoding='UTF-8'?>" +
            "<osm version='0.6' generator='OpenStreetMap server'>" +
            "  <user id='123' display_name='IHM Test' account_created='2013-03-09T17:55:56Z'>" +
            "    <img href='image.png'/>" +
            "    <changesets count='205'/>" +
            "    <traces count='15'/>" +
            "  </user>" +
            "</osm>"
        );
        var gpxFilesResponse = x2Js.parseXmlString(
            "<?xml version='1.0' encoding='UTF-8'?>" +
            "<osm version='0.6' generator='OpenStreetMap server' copyright='OpenStreetMap and contributors' attribution='http://www.openstreetmap.org/copyright' license='http://opendatacommons.org/licenses/odbl/1-0/'>" +
            "  <gpx_file id='1' name='name.gpx' lat='0' lon='0' user='IHM Test' visibility='private' pending='false' timestamp='2016-11-12T15:22:27Z'>" +
            "    <description>הגובה הגדולה</description>" +
            "    <tag>הגולן</tag>" +
            "    <tag>רמת</tag>" +
            "  </gpx_file>" +
            "</osm>"
        );


        var osmUserService: IsraelHiking.Services.OsmUserService;
        var $q: angular.IQService;
        var $http: angular.IHttpService;
        var $httpBackend: angular.IHttpBackendService;
        var localStorageService: angular.local.storage.ILocalStorageService;
        var oauth;

        beforeEach(() => {
            angular.mock.module("LocalStorageModule");
            angular.mock.module("gettext");
            angular.mock.inject((_$http_: angular.IHttpService, _$httpBackend_: angular.IHttpBackendService, _$q_: angular.IQService, _localStorageService_: angular.local.storage.ILocalStorageService) => { // 
                // The injector unwraps the underscores (_) from around the parameter names when matching
                $http = _$http_;
                $q = _$q_;
                $httpBackend = _$httpBackend_;
                localStorageService = _localStorageService_;
                $httpBackend.whenGET(url => url.indexOf(Common.Urls.osmConfiguration) !== -1).respond(200,
                    {
                        data: {
                            BaseAddress: "osm.base.address",
                            ConsumerKey: "ConsumerKey",
                            ConsumerSecret: "ConsumerSecret"
                        }
                    });
                oauth = {
                    authenticated: () => false,
                    logout: () => {}
                };
                osmAuth = () => {
                    return oauth;
                };
                osmUserService = new IsraelHiking.Services.OsmUserService(_$q_, $http, localStorageService);
                $httpBackend.flush();
            });
        });

        it("Should not refresh details on construction when not logged in", () => {

            localStorageService.get = () => null;
            $httpBackend.whenGET(url => url.indexOf(Common.Urls.osmConfiguration) !== -1).respond(200,
                {
                    data: {
                        BaseAddress: "osm.base.address",
                        ConsumerKey: "ConsumerKey",
                        ConsumerSecret: "ConsumerSecret"
                    }
                });
            osmUserService = new IsraelHiking.Services.OsmUserService($q, $http, localStorageService);
            $httpBackend.flush();
            expect(osmUserService.isLoggedIn()).toBe(false);
        });

        it("Should return error on construction when logged in", () => {

            localStorageService.get = () => "AUTHORIZATION_DATA_KEY";
            $httpBackend.whenGET(url => url.indexOf(Common.Urls.osmConfiguration) !== -1).respond(200,
                {
                    data: {
                        BaseAddress: "osm.base.address",
                        ConsumerKey: "ConsumerKey",
                        ConsumerSecret: "ConsumerSecret"
                    }
                });
            oauth.authenticated = () => { return true; };
            oauth.xhr = (addressObject, callback: Function) => {
                callback("error");
            };

            osmUserService = new IsraelHiking.Services.OsmUserService($q, $http, localStorageService);
            $httpBackend.flush();
            osmUserService.login();

            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.loading).toBe(false);
        });

        it("Should login and get data", () => {
            $httpBackend.whenGET(url => url.indexOf(Common.Urls.urls) !== -1).respond(200, [{ title: "some share" } as Common.SiteUrl]);
            oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
                if (addressObject.path.indexOf("gpx_files") !== -1) {
                    callback(null, gpxFilesResponse);
                }
            }
            osmUserService.login();
            $httpBackend.flush();
            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.loading).toBe(false);
            expect(osmUserService.shares.length).toBe(1);
            expect(osmUserService.traces.length).toBe(1);
        });

        it("Should login and get data even if gpx files fail", () => {
            $httpBackend.whenGET(url => url.indexOf(Common.Urls.urls) !== -1).respond(200, [{ title: "some share" } as Common.SiteUrl]);
            oauth.authenticated = () => { return true; },
                oauth.xhr = (addressObject, callback: Function) => {
                    if (addressObject.path.indexOf("details") !== -1) {
                        callback(null, userDetailsResponse);
                    }
                    if (addressObject.path.indexOf("gpx_files") !== -1) {
                        callback("error");
                    }
                }
            osmUserService.login();
            $httpBackend.flush();
            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.loading).toBe(false);
            expect(osmUserService.shares.length).toBe(1);
            expect(osmUserService.traces.length).toBe(0);
        });

        it("Should logout", () => {
            let loggedOut = false;
            oauth.logout = () => { loggedOut = true; }
            osmUserService.logout();

            expect(loggedOut).toBe(true);
        });

        it("Should update site url", () => {
            let siteUrl = { id: "42" } as Common.SiteUrl;
            $httpBackend.expectPUT(Common.Urls.urls + siteUrl.id).respond({status: 200});
            osmUserService.updateSiteUrl(siteUrl);

            expect($httpBackend.flush).not.toThrow();
        });

        it("Should delete site url", () => {
            let siteUrl = { id: "42" } as Common.SiteUrl;
            osmUserService.shares = [siteUrl];
            
            $httpBackend.expectDELETE(Common.Urls.urls + siteUrl.id).respond({ status: 200 });
            osmUserService.deleteSiteUrl(siteUrl);

            expect($httpBackend.flush).not.toThrow();
            expect(osmUserService.shares.length).toBe(0);
        });

        it("Should get missing parts", () => {
            $httpBackend.expectPOST((url) => url.indexOf(Common.Urls.osm) !== -1).respond({ status: 200 });
            osmUserService.getMissingParts({} as IsraelHiking.Services.ITrace);

            expect($httpBackend.flush).not.toThrow();
        });

        it("Should add missing parts", () => {
            $httpBackend.expectPUT((url) => url.indexOf(Common.Urls.osm) !== -1).respond({ status: 200 });
            osmUserService.addAMissingPart({} as GeoJSON.Feature<GeoJSON.LineString>);

            expect($httpBackend.flush).not.toThrow();
        });

        it("Should get image for site url", () => {
            let siteUrl = { id: "42" } as Common.SiteUrl;
            let imageUrl = osmUserService.getImageFromSiteUrlId(siteUrl);

            expect(imageUrl).toContain(siteUrl.id);
        });

        it("Should return full address of osm edit location", () => {
            let address = osmUserService.getEditOsmLocationAddress(Common.Urls.DEFAULT_TILES_ADDRESS, 13, L.latLng(0, 0));

            expect(address).toContain(Common.Urls.baseAddress);
            expect(address).toContain(Common.Urls.DEFAULT_TILES_ADDRESS);
            expect(address).toContain("map=");
        });

        it("Should return full address of osm edit with gpx", () => {
            let gpxId = "100";

            let address = osmUserService.getEditOsmGpxAddress(Common.Urls.DEFAULT_TILES_ADDRESS, gpxId);

            expect(address).toContain(Common.Urls.baseAddress);
            expect(address).toContain(Common.Urls.DEFAULT_TILES_ADDRESS);
            expect(address).toContain(gpxId);
        });

        it("Should return full address of shared route", () => {
            let siteUrl = { id: "12345" } as Common.SiteUrl;
            
            let address = osmUserService.getUrlFromSiteUrlId(siteUrl);

            expect(address).toContain("/#!/");
            expect(address).toContain(Common.Urls.baseAddress);
            expect(address).toContain(siteUrl.id);
        });
    });
}