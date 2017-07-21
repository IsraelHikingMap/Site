import { HttpModule, Http, Response, ResponseOptions, XHRBackend, RequestMethod } from "@angular/http";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { MockBackend, MockConnection } from "@angular/http/testing";
import * as X2JS from "x2js";

import { OsmUserService, ITrace } from "./osm-user.service";
import { AuthorizationService } from "./authorization.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";


describe("OSM User Service", () => {
    var oauth: OSMAuth.OSMAuthInstance;
    var x2Js = new X2JS();
    var userDetailsResponse = x2Js.xml2dom(
        "<?xml version='1.0' encoding='UTF-8'?>" +
        "<osm version='0.6' generator='OpenStreetMap server'>" +
        "  <user id='123' display_name='IHM Test' account_created='2013-03-09T17:55:56Z'>" +
        "    <img href='image.png'/>" +
        "    <changesets count='205'/>" +
        "    <traces count='15'/>" +
        "  </user>" +
        "</osm>"
    );
    var gpxFilesResponse = x2Js.xml2dom(
        "<?xml version='1.0' encoding='UTF-8'?>" +
        "<osm version='0.6' generator='OpenStreetMap server' copyright='OpenStreetMap and contributors' attribution='http://www.openstreetmap.org/copyright' license='http://opendatacommons.org/licenses/odbl/1-0/'>" +
        "  <gpx_file id='1' name='name.gpx' lat='0' lon='0' user='IHM Test' visibility='private' pending='false' timestamp='2016-11-12T15:22:27Z'>" +
        "    <description>הגובה הגדולה</description>" +
        "    <tag>הגולן</tag>" +
        "    <tag>רמת</tag>" +
        "  </gpx_file>" +
        "</osm>"
    );

    beforeEach(() => {
        oauth = {
            authenticated: () => false,
            logout: () => { return oauth }
        } as OSMAuth.OSMAuthInstance;

        TestBed.configureTestingModule({
            imports: [HttpModule],
            providers: [
                { provide: XHRBackend, useClass: MockBackend },
                AuthorizationService,
                {
                    provide: OsmUserService,
                    useFactory: fakeAsync((http, authorizationService: AuthorizationService, mockBackend: MockBackend) => {
                        mockBackend.connections.subscribe((connection: MockConnection) => {
                            if (connection.request.url.indexOf(Urls.osmConfiguration) === -1) {
                                return;
                            }
                            connection.mockRespond(new Response(new ResponseOptions({
                                body: JSON.stringify({
                                    BbseAddress: "osm.base.address",
                                    consumerKey: "ConsumerKey",
                                    consumerSecret: "ConsumerSecret"
                                })
                            })));
                        });
                        spyOn(authorizationService, "createOSMAuth").and.returnValue(oauth);
                        return new OsmUserService(http, authorizationService);
                    }),
                    deps: [Http, AuthorizationService, XHRBackend]
                }
            ]
        });
    });

    it("Should not refresh details on construction when not logged in", inject([OsmUserService], (osmUserService: OsmUserService) => {

        //$httpBackend.whenGET(url => url.indexOf(Common.Urls.osmConfiguration) !== -1).respond(200,
        //    {
        //        data: {
        //            BaseAddress: "osm.base.address",
        //            ConsumerKey: "ConsumerKey",
        //            ConsumerSecret: "ConsumerSecret"
        //        }
        //    });
        //$httpBackend.flush();
        expect(osmUserService.isLoggedIn()).toBeFalsy();
    }));

    /*

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
    */
    it("Should login and get data", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {

        oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
                if (addressObject.path.indexOf("gpx_files") !== -1) {
                    callback(null, gpxFilesResponse);
                }
            }
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls) === -1) {
                return;
            }
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify([{ title: "some share" } as Common.SiteUrl])
            })));
        });

        osmUserService.login();
        flushMicrotasks();

        expect(osmUserService.isLoggedIn()).toBeTruthy();
        expect(osmUserService.siteUrls.length).toBe(1);
        expect(osmUserService.traces.length).toBe(1);
    })));
    
    it("Should login and get data even if gpx files fail", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {

        oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
                if (addressObject.path.indexOf("gpx_files") !== -1) {
                    callback("error");
                }
            }
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls) === -1) {
                return;
            }
            connection.mockRespond(new Response(new ResponseOptions({
                body: JSON.stringify([{ title: "some share" } as Common.SiteUrl])
            })));
        });
        osmUserService.login().then(() => {
            fail();
        }, () => {
            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.siteUrls.length).toBe(1);
            expect(osmUserService.traces.length).toBe(0);
        });
        flushMicrotasks();
    })));


    it("Should logout", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let loggedOut = false;
        oauth.logout = () => { loggedOut = true; return oauth; }
        osmUserService.logout();

        expect(loggedOut).toBeTruthy();
    }));

    
    it("Should update site url", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {
        let siteUrl = { id: "42" } as Common.SiteUrl;
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls + siteUrl.id) === -1 || connection.request.method !== RequestMethod.Put) {
                fail();
            }
        });

        osmUserService.updateSiteUrl(siteUrl);
        flushMicrotasks();
    })));

    it("Should delete site url", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {
        let siteUrl = { id: "42" } as Common.SiteUrl;
        osmUserService.siteUrls = [siteUrl];

        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls + siteUrl.id) === -1 || connection.request.method !== RequestMethod.Delete) {
                fail();
            }
            connection.mockRespond(new Response(new ResponseOptions()));
        });

        osmUserService.deleteSiteUrl(siteUrl);
    
        flushMicrotasks();
        expect(osmUserService.siteUrls.length).toBe(0);
    })));

    
    it("Should get missing parts", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {

        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.osm) === -1 || connection.request.method !== RequestMethod.Post) {
                fail();
            }
        });

        osmUserService.getMissingParts({} as ITrace);
        flushMicrotasks();
    })));
    
    it("Should add missing parts", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {

        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.osm) === -1 || connection.request.method !== RequestMethod.Put) {
                fail();
            }
        });
        osmUserService.addAMissingPart({} as GeoJSON.Feature<GeoJSON.LineString>);
        flushMicrotasks();
    })));

    
    it("Should get image for site url", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let siteUrl = { id: "42" } as Common.SiteUrl;
        let imageUrl = osmUserService.getImageFromSiteUrlId(siteUrl);

        expect(imageUrl).toContain(siteUrl.id);
    }));

    
    it("Should return full address of osm edit location", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let address = osmUserService.getEditOsmLocationAddress(Urls.DEFAULT_TILES_ADDRESS, 13, L.latLng(0, 0));

        expect(address).toContain(Urls.baseAddress);
        expect(address).toContain(Urls.DEFAULT_TILES_ADDRESS);
        expect(address).toContain("map=");
    }));

    it("Should return full address of osm edit with gpx", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let gpxId = "100";

        let address = osmUserService.getEditOsmGpxAddress(Urls.DEFAULT_TILES_ADDRESS, gpxId);

        expect(address).toContain(Urls.baseAddress);
        expect(address).toContain(Urls.DEFAULT_TILES_ADDRESS);
        expect(address).toContain(gpxId);
    }));

    
    it("Should return full address of shared route", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let siteUrl = { id: "12345" } as Common.SiteUrl;

        let address = osmUserService.getUrlFromSiteUrlId(siteUrl);

        expect(address).toContain("/#!/");
        expect(address).toContain(Urls.baseAddress);
        expect(address).toContain(siteUrl.id);
    }));
});