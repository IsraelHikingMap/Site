import { TestBed, inject, fakeAsync, flushMicrotasks } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";

import { OsmUserService } from "./osm-user.service";
import { AuthorizationService } from "./authorization.service";
import { WhatsAppService } from "./whatsapp.service";
import { HashService } from "./hash.service";
import { Urls } from "../urls";
import { ShareUrl, DataContainer } from "../models/models";
import { ITrace } from "./traces.service";

describe("OSM User Service", () => {
    beforeEach(() => {
        let authService = {
            logout: () => { },
            authenticated: () => false,
            setOptions: () => { },
            authenticate: () => Promise.resolve()
        };
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
            baseAddress: "osm.base.address",
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

            let promise = osmUserService.initialize().then(() => {
                expect(osmUserService.isLoggedIn()).toBeFalsy();
            });
            setupInit(mockBackend);
            return promise;
        }));

    it("Should login and get data", inject([OsmUserService, AuthorizationService, HttpTestingController],
        fakeAsync((osmUserService: OsmUserService, auth: AuthorizationService, mockBackend: HttpTestingController) => {

            spyOn(auth, "authenticate");

            osmUserService.initialize();
            setupInit(mockBackend);
            flushMicrotasks();
            osmUserService.login();
            flushMicrotasks();
            mockBackend.expectOne(Urls.osmUser).flush({});
            flushMicrotasks();
            mockBackend.expectOne(Urls.urls).flush([{ title: "some share" } as ShareUrl]);
            mockBackend.expectOne(Urls.osmTrace).flush([{ id: "id", name: "name" } as ITrace]);
            flushMicrotasks();
            expect(auth.authenticate).toHaveBeenCalled();
            expect(osmUserService.shareUrls.length).toBe(1);
            expect(osmUserService.traces.length).toBe(1);
        })));

    it("Should login even if requests for data fails",
        inject([OsmUserService, AuthorizationService, HttpTestingController],
            fakeAsync((osmUserService: OsmUserService, auth: AuthorizationService, mockBackend: HttpTestingController) => {

                auth.authenticated = () => true;
                spyOn(auth, "authenticate");
                osmUserService.initialize();
                flushMicrotasks();
                setupInit(mockBackend);
                flushMicrotasks();
                mockBackend.expectOne(Urls.osmUser).flush({});
                flushMicrotasks();
                osmUserService.login().catch(() => {
                    expect(auth.authenticate).toHaveBeenCalled();
                    expect(osmUserService.shareUrls.length).toBe(0);
                    expect(osmUserService.traces.length).toBe(0);
                });
                flushMicrotasks();
                mockBackend.expectOne(Urls.osmUser).flush(null, { status: 401, statusText: "Unauthorized" });
            })));


    it("Should logout", inject([OsmUserService, AuthorizationService],
        (osmUserService: OsmUserService, authorizationService: AuthorizationService) => {
            spyOn(authorizationService, "logout");
            osmUserService.logout();
            expect(authorizationService.logout).toHaveBeenCalled();
        }));


    it("Should update site url", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

            let shareUrl = { id: "42" } as ShareUrl;

            let promise = osmUserService.updateShareUrl(shareUrl).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            return promise;
        }));

    it("Should delete site url", inject([OsmUserService, HttpTestingController],
        async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

            let shareUrl = { id: "42" } as ShareUrl;
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
        let address = osmUserService.getEditOsmLocationAddress(Urls.DEFAULT_TILES_ADDRESS, 13, LatLngAlt(0, 0));

        expect(address).toContain(Urls.baseTilesAddress);
        expect(address).toContain(Urls.DEFAULT_TILES_ADDRESS);
        expect(address).toContain("map=");
    }));

    it("Should return full address of osm edit with gpx", inject([OsmUserService], (osmUserService: OsmUserService) => {
        let gpxId = "100";

        let address = osmUserService.getEditOsmGpxAddress(Urls.DEFAULT_TILES_ADDRESS, gpxId);

        expect(address).toContain(Urls.baseTilesAddress);
        expect(address).toContain(Urls.DEFAULT_TILES_ADDRESS);
        expect(address).toContain(gpxId);
    }));

    it("Should return social links", inject([OsmUserService, HashService], (osmUserService: OsmUserService, hashService: HashService) => {
        let shareUrl = { id: "12345" } as ShareUrl;

        let links = osmUserService.getShareSocialLinks(shareUrl);

        expect(hashService.getFullUrlFromShareId).toHaveBeenCalled();
        expect(links.facebook).toContain("facebook");
        expect(links.whatsapp).toContain("whatsapp");
        expect(links.nakeb).toContain("nakeb");
    }));

    it("Should get image preview by sending a request to server",
        inject([OsmUserService, HttpTestingController], async (osmUserService: OsmUserService, mockBackend: HttpTestingController) => {

            let promise = osmUserService.getImagePreview({} as DataContainer).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.images).flush(new Blob());
            return promise;
        }));
});