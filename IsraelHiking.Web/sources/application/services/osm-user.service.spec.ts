import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import * as L from "leaflet";
import * as X2JS from "x2js";

import { OsmUserService, ITrace } from "./osm-user.service";
import { AuthorizationService } from "./authorization.service";
import { WhatsAppService } from "./whatsapp.service";
import { HashService } from "./hash.service";
import { Urls } from "../common/Urls";
import * as Common from "../common/IsraelHiking";

describe("OSM User Service", () => {
    let oauth: OSMAuth.OSMAuthInstance;
    let x2Js = new X2JS();
    let userDetailsResponse = x2Js.xml2dom(
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
            logout: () => oauth
        } as OSMAuth.OSMAuthInstance;
        let authService = {
            osmToken: null,
            createOSMAuth: () => oauth
        } as AuthorizationService;
        let hashService = {
            getFullUrlFromShareId: jasmine.createSpy("getFullUrlFromShareId")
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: AuthorizationService, useValue: authService },
                { provide: HashService, useValue: hashService },
                WhatsAppService,
                OsmUserService
            ]
        });
    });

    let setupInit = (mockBackend: HttpTestingController) => {
        mockBackend.expectOne(Urls.osmConfiguration).flush({
            BbseAddress: "osm.base.address",
            consumerKey: "ConsumerKey",
            consumerSecret: "ConsumerSecret"
        });
    };

    it("Should initialize on demand", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        osmUserService.initialize();
        setupInit(mockBackend);
        expect(osmUserService.isLoggedIn()).toBeFalsy();
    }));

    it("Should not refresh details when not logged in", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        spyOn(oauth, "logout");

        let promise = osmUserService.initialize().then(() => {
            expect(osmUserService.isLoggedIn()).toBeFalsy();
            expect(oauth.logout).toHaveBeenCalled();
        });
        setupInit(mockBackend);
        return promise;
    }));

    it("Should login and get data", inject([OsmUserService, HttpTestingController],
        fakeAsync((osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        oauth.authenticated = () => true;
        oauth.xhr = (addressObject, callback: Function) => {
            if (addressObject.path.includes("details")) {
                callback(null, userDetailsResponse);
            }
        };
        osmUserService.initialize();
        setupInit(mockBackend);
        flushMicrotasks();
        osmUserService.login();
        flushMicrotasks();
        mockBackend.expectOne(Urls.urls).flush([{ title: "some share" } as Common.ShareUrl]);
        mockBackend.expectOne(Urls.osmTrace).flush([{ id: "id", name: "name" } as ITrace]);
        flushMicrotasks();
        expect(osmUserService.isLoggedIn()).toBeTruthy();
        expect(osmUserService.shareUrls.length).toBe(1);
        expect(osmUserService.traces.length).toBe(1);
    })));

    it("Should login even if requests for data fails",
        inject([OsmUserService, HttpTestingController], fakeAsync((osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        oauth.authenticated = () => true;
        oauth.xhr = (addressObject, callback: Function) => {
            if (addressObject.path.includes("details")) {
                callback(null, userDetailsResponse);
            }
        };
        osmUserService.initialize();
        setupInit(mockBackend);
        flushMicrotasks();
        osmUserService.login().catch(() => {
            expect(osmUserService.isLoggedIn()).toBe(true);
            expect(osmUserService.shareUrls.length).toBe(0);
            expect(osmUserService.traces.length).toBe(0);
        });
        flushMicrotasks();
        flushMicrotasks();
        mockBackend.expectOne(Urls.urls).flush(null, { status: 401, statusText: "Unauthorizes" });
        mockBackend.expectOne(Urls.osmTrace).flush(null, { status: 401, statusText: "Unauthorizes" });
    })));


    it("Should logout", inject([OsmUserService, AuthorizationService],
        (osmUserService: OsmUserService, authorizationService: AuthorizationService) => {

        authorizationService.osmToken = "42";
        osmUserService.logout();
        expect(authorizationService.osmToken).toBeNull();
    }));


    it("Should update site url", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        let shareUrl = { id: "42" } as Common.ShareUrl;

        let promise = osmUserService.updateShareUrl(shareUrl).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
        return promise;
    }));

    it("Should delete site url", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        let shareUrl = { id: "42" } as Common.ShareUrl;
        osmUserService.shareUrls = [shareUrl];

        let promise = osmUserService.deleteShareUrl(shareUrl).then(() => {
            expect(osmUserService.shareUrls.length).toBe(0);
        });

        mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
        return promise;
    }));


    it("Should get missing parts", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        let trace = { dataUrl: "123" } as ITrace;

        let promise = osmUserService.getMissingParts(trace).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne(Urls.osm + "?url=" + trace.dataUrl).flush({});
        return promise;
    }));

    it("Should add missing parts", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        let promise = osmUserService.addAMissingPart({} as GeoJSON.Feature<GeoJSON.LineString>).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne(Urls.osm).flush({});
        return promise;
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


    it("Should return full address of shared route", inject([OsmUserService, HashService],
        (osmUserService: OsmUserService, hashService: HashService) => {
        let shareUrl = { id: "12345" } as Common.ShareUrl;

        osmUserService.getUrlFromShareId(shareUrl);

        expect(hashService.getFullUrlFromShareId).toHaveBeenCalled();
    }));

    it("Should return social links", inject([OsmUserService, HashService], (osmUserService: OsmUserService, hashService: HashService) => {
        let shareUrl = { id: "12345" } as Common.ShareUrl;

        let links = osmUserService.getShareSocialLinks(shareUrl);

        expect(hashService.getFullUrlFromShareId).toHaveBeenCalled();
        expect(links.facebook).toContain("facebook");
        expect(links.whatsapp).toContain("whatsapp");
        expect(links.nakeb).toContain("nakeb");
    }));

    it("Should get image preview by sending a request to server",
        inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

        let promise = osmUserService.getImagePreview({} as Common.DataContainer).then((res) => {
            expect(res).not.toBeNull();
        });

        mockBackend.expectOne(Urls.images).flush(new Blob());
        return promise;
    }));
});