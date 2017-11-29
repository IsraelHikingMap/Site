import { TestBed, inject, fakeAsync} from "@angular/core/testing";
import { HttpClientModule, HttpClient } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
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
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                AuthorizationService,
                {
                    provide: OsmUserService,
                    useFactory: fakeAsync((http, authorizationService: AuthorizationService, mockBackend: HttpTestingController) => {

                        spyOn(authorizationService, "createOSMAuth").and.returnValue(oauth);
                        let osmUserService = new OsmUserService(http, authorizationService);
                        mockBackend.expectOne(Urls.osmConfiguration).flush({
                            BbseAddress: "osm.base.address",
                            consumerKey: "ConsumerKey",
                            consumerSecret: "ConsumerSecret"
                        });
                        
                        return osmUserService;
                    }),
                    deps: [HttpClient, AuthorizationService, HttpTestingController]
                }
            ]
        });
    });

    it("Should not refresh details on construction when not logged in", inject([OsmUserService], (osmUserService: OsmUserService) => {
        expect(osmUserService.isLoggedIn()).toBeFalsy();
    }));

    it("Should login and get data", inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
            }

        osmUserService.login().then(() => {
            expect(osmUserService.isLoggedIn()).toBeTruthy();
            expect(osmUserService.shareUrls.length).toBe(1);
            expect(osmUserService.traces.length).toBe(1);
        });

        mockBackend.expectOne(Urls.urls).flush([{ title: "some share" } as Common.ShareUrl]);
        mockBackend.expectOne(Urls.osmTrace).flush([{ id: "id", name: "name" } as ITrace]);
    }));
    
    it("Should login even if requests for data fails", inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        oauth.authenticated = () => { return true; },
            oauth.xhr = (addressObject, callback: Function) => {
                if (addressObject.path.indexOf("details") !== -1) {
                    callback(null, userDetailsResponse);
                }
            }

        osmUserService.login().then(fail, () => {
            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.shareUrls.length).toBe(0);
            expect(osmUserService.traces.length).toBe(0);    
            });

        mockBackend.expectOne(Urls.urls).flush(null, { status: 401, statusText: "Unauthorizes" });
        mockBackend.expectOne(Urls.osmTrace).flush(null, { status: 401, statusText: "Unauthorizes" });
    }));


    it("Should logout", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let loggedOut = false;
        oauth.logout = () => { loggedOut = true; return oauth; }
        osmUserService.logout();

        expect(loggedOut).toBeTruthy();
    }));

    
    it("Should update site url", inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {
        let shareUrl = { id: "42" } as Common.ShareUrl;

        osmUserService.updateShareUrl(shareUrl);

        mockBackend.expectOne(Urls.urls + shareUrl.id);
    }));

    it("Should delete site url", inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {
        let shareUrl = { id: "42" } as Common.ShareUrl;
        osmUserService.shareUrls = [shareUrl];

        osmUserService.deleteShareUrl(shareUrl).then(() => {
            expect(osmUserService.shareUrls.length).toBe(0);    
        });
    
        mockBackend.expectOne(Urls.urls + shareUrl.id);
    }));

    
    it("Should get missing parts", inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {
        let trace = { dataUrl: "123" } as ITrace;

        osmUserService.getMissingParts(trace);

        mockBackend.expectOne(Urls.osm + "?url=" + trace.dataUrl);
    }));
    
    it("Should add missing parts", inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {
        osmUserService.addAMissingPart({} as GeoJSON.Feature<GeoJSON.LineString>);

        mockBackend.expectOne(Urls.osm);
    }));

    
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