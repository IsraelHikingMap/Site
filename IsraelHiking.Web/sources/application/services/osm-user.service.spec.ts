import { HttpModule, Http, Response, ResponseOptions, XHRBackend, RequestMethod } from "@angular/http";
import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { MockBackend, MockConnection } from "@angular/http/testing";
import * as L from "leaflet";
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
        expect(osmUserService.isLoggedIn()).toBeFalsy();
    }));

    it("Should login and get data", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {

        oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
            }
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls) !== -1) {
                connection.mockRespond(new Response(new ResponseOptions({
                    body: JSON.stringify([{ title: "some share" } as Common.ShareUrl])
                })));
                return;
            }
            if (connection.request.url.indexOf(Urls.osmTrace) !== -1) {
                connection.mockRespond(new Response(new ResponseOptions({
                    body: JSON.stringify([{ id: "id", name: "name" } as ITrace])
                })));
                return;
            }
        });

        osmUserService.login();
        flushMicrotasks();

        expect(osmUserService.isLoggedIn()).toBeTruthy();
        expect(osmUserService.shareUrls.length).toBe(1);
        expect(osmUserService.traces.length).toBe(1);
    })));
    
    it("Should login even if requests for data fails", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {

        oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
            }
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.osmTrace) !== -1) {
                connection.mockError(new Error("Error!"));
                return;
            }
            if (connection.request.url.indexOf(Urls.urls) !== -1) {
                connection.mockError(new Error("Error!"));
                return;
            }
        });
        osmUserService.login().then(() => {
            fail();
        }, () => {
            flushMicrotasks();
            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.shareUrls.length).toBe(0);
            expect(osmUserService.traces.length).toBe(0);    
        });
    })));


    it("Should logout", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let loggedOut = false;
        oauth.logout = () => { loggedOut = true; return oauth; }
        osmUserService.logout();

        expect(loggedOut).toBeTruthy();
    }));

    
    it("Should update site url", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {
        let shareUrl = { id: "42" } as Common.ShareUrl;
        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls + shareUrl.id) === -1 || connection.request.method !== RequestMethod.Put) {
                fail();
            }
        });

        osmUserService.updateShareUrl(shareUrl);
        flushMicrotasks();
    })));

    it("Should delete site url", inject([OsmUserService, XHRBackend], fakeAsync((osmUserService: OsmUserService, mockBackend: MockBackend) => {
        let shareUrl = { id: "42" } as Common.ShareUrl;
        osmUserService.shareUrls = [shareUrl];

        mockBackend.connections.subscribe((connection: MockConnection) => {
            if (connection.request.url.indexOf(Urls.urls + shareUrl.id) === -1 || connection.request.method !== RequestMethod.Delete) {
                fail();
            }
            connection.mockRespond(new Response(new ResponseOptions()));
        });

        osmUserService.deleteShareUrl(shareUrl);
    
        flushMicrotasks();
        expect(osmUserService.shareUrls.length).toBe(0);
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
        let shareUrl = { id: "42" } as Common.ShareUrl;
        let imageUrl = osmUserService.getImageFromShareId(shareUrl);

        expect(imageUrl).toContain(shareUrl.id);
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
        let shareUrl = { id: "12345" } as Common.ShareUrl;

        let address = osmUserService.getUrlFromShareId(shareUrl);

        expect(address).toContain("/#!/");
        expect(address).toContain(Urls.baseAddress);
        expect(address).toContain(shareUrl.id);
    }));
});