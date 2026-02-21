import { TestBed, inject } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { ShareUrlsService } from "./share-urls.service";
import { WhatsAppService } from "./whatsapp.service";
import { HashService } from "./hash.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { MapService } from "./map.service";
import { AddShareUrlAction, RemoveShareUrlAction, ShareUrlsReducer, UpdateShareUrlAction, SetShareUrlsLastModifiedDateAction } from "../reducers/share-urls.reducer";
import { Urls } from "../urls";
import type { ShareUrl } from "../models";

describe("Share Urls Service", () => {
    beforeEach(() => {
        const hashService = {
            getFullUrlFromShareId: jasmine.createSpy("getFullUrlFromShareId")
        };
        const databaseService = {
            getShareUrlById: () => { },
            storeShareUrl: () => { },
            deleteShareUrlById: jasmine.createSpy()
        };
        const loggingService = {
            info: () => { },
            error: () => { },
            warning: () => { }
        };
        TestBed.configureTestingModule({
            imports: [
                NgxsModule.forRoot([ShareUrlsReducer])],
            providers: [
                { provide: HashService, useValue: hashService },
                { provide: LoggingService, useValue: loggingService },
                { provide: DatabaseService, useValue: databaseService },
                { provide: MapService, useValue: { map: { getCanvas: () => ({ toDataURL: () => "url" }) } } },
                RunningContextService,
                WhatsAppService,
                ShareUrlsService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should not do anything in initialization if user is not logged in", inject([ShareUrlsService, HttpTestingController, Store],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, store: Store) => {

            store.reset({
                userState: {
                    userInfo: null
                }
            })

            await shareUrlsService.initialize();

            expect(() => mockBackend.expectNone(Urls.urls)).not.toThrow();
        }
    ));

    it("Should sync urls when initializing", inject([ShareUrlsService, HttpTestingController, Store],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, store: Store) => {
            const spy = jasmine.createSpy();
            store.dispatch = spy;
            store.reset({
                userState: {
                    userInfo: {}
                },
                shareUrlsState: {
                    shareUrlsLastModifiedDate: null,
                    shareUrls: [{
                        id: "1"
                    }, {
                        id: "2"
                    }]
                }
            })
            const promise = shareUrlsService.initialize();

            mockBackend.expectOne(Urls.urls).flush([{
                id: "2",
                start: { lat: 1, lng: 1 },
            }, {
                id: "3",
                start: { lat: 1, lng: 1 },
            }]);
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "2").flush({
                start: { lat: 1, lng: 1 },
            });

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "3").flush({
                start: { lat: 1, lng: 1 },
            });

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(UpdateShareUrlAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(AddShareUrlAction);
            expect(spy.calls.all()[2].args[0]).toBeInstanceOf(RemoveShareUrlAction);
            expect(spy.calls.all()[3].args[0]).toBeInstanceOf(SetShareUrlsLastModifiedDateAction);

            await promise;
        }
    ));

    it("Should get display name only for the title", inject([ShareUrlsService], (shareUrlService: ShareUrlsService) => {
        expect(shareUrlService.getShareUrlDisplayName({ title: "title" } as ShareUrl)).toBe("title");
    }));

    it("Should get display name for title and description", inject([ShareUrlsService], (shareUrlService: ShareUrlsService) => {
        const displayName = shareUrlService.getShareUrlDisplayName({ title: "title", description: "desc" } as ShareUrl);
        expect(displayName).toContain("title");
        expect(displayName).toContain("desc");
    }));

    it("Should get social links", inject([ShareUrlsService], (shareUrlService: ShareUrlsService) => {
        const links = shareUrlService.getShareSocialLinks({ title: "title", description: "desc" } as ShareUrl);
        expect(links.facebook).toContain(Urls.facebook);
    }));

    it("Should get share url from database when already cached and don't refresh it if it's not newer", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => Promise.resolve({ lastModifiedDate: new Date().toISOString() } as ShareUrl);

            const promise = shareUrlsService.getShareUrl("5");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "5/timestamp").flush(new Date(0).toISOString());

            expect(() => mockBackend.expectNone(Urls.urls)).not.toThrow();
            await promise;
        }
    ));

    it("Should get share url from server if not cached", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => null;

            const promise = shareUrlsService.getShareUrl("6");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "6").flush({
                start: { lat: 1, lng: 1 },
            });

            const response = await promise;
            expect(response).toBeDefined();
            expect(response.start.lat).toBe(1);
            expect(response.start.lng).toBe(1);
        }
    ));

    it("Should get share url from server if not cached and use datacontainer routes to set start point", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => null;

            const promise = shareUrlsService.getShareUrl("6");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "6").flush({
                dataContainer: { routes: [{ segments: [{ latlngs: [{ lat: 1, lng: 1 }] }] }] },
            });

            const response = await promise;
            expect(response).toBeDefined();
            expect(response.start.lat).toBe(1);
            expect(response.start.lng).toBe(1);
        }
    ));

    it("Should get share url from server if not cached and use datacontainer corners to set start point", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => null;

            const promise = shareUrlsService.getShareUrl("6");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "6").flush({
                dataContainer: { northEast: { lat: 0, lng: 0 }, southWest: { lat: 2, lng: 2 } },
            });

            const response = await promise;
            expect(response).toBeDefined();
            expect(response.start.lat).toBe(1);
            expect(response.start.lng).toBe(1);
        }
    ));

    it("Should get share url from database when already cached and try to refresh it since it's newer", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => Promise.resolve({ lastModifiedDate: new Date(100).toISOString() } as ShareUrl);

            const promise = shareUrlsService.getShareUrl("7");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "7/timestamp").flush(new Date(200).toISOString());

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(() => mockBackend.expectOne(Urls.urls + "7").flush({
                start: { lat: 1, lng: 1 },
            })).not.toThrow();
            await promise;
        }
    ));

    it("Should get share url from database when already cached and try to refresh twice it since it's newer and first fast refresh failed", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => Promise.resolve({ lastModifiedDate: new Date(100).toISOString() } as ShareUrl);

            const promise = shareUrlsService.getShareUrl("7");
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            mockBackend.expectOne(Urls.urls + "7/timestamp").flush(new Date(200).toISOString());
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            mockBackend.expectOne(Urls.urls + "7").flush(null, { status: 500, statusText: "Internal Server Error" });
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(() => mockBackend.expectOne(Urls.urls + "7").flush({
                start: { lat: 1, lng: 1 },
            })).not.toThrow();
            await promise;
        }
    ));

    it("Should create share url", inject([ShareUrlsService, HttpTestingController],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            const shareUrl = { id: "42" } as ShareUrl;

            const promise = shareUrlsService.createShareUrl(shareUrl).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.urls).flush({});
            await promise;
        }
    ));

    it("Should update share url", inject([ShareUrlsService, HttpTestingController],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            const shareUrl = { id: "42" } as ShareUrl;

            const promise = shareUrlsService.updateShareUrl(shareUrl).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            await promise;
        }
    ));

    it("Should delete share url", inject([ShareUrlsService, HttpTestingController, DatabaseService, Store],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService, store: Store) => {

            const shareUrl = { id: "42" } as ShareUrl;
            store.dispatch = jasmine.createSpy();
            const promise = shareUrlsService.deleteShareUrl(shareUrl).then(() => {

                expect(store.dispatch).toHaveBeenCalled();
                expect(databaseService.deleteShareUrlById).toHaveBeenCalled();
            });

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            await promise;
        }
    ));

    it("Should get image for share url", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        const imageUrl = shareUrlsService.getImageUrlFromShareId("42");

        expect(imageUrl).toContain("42");
    }));

    it("Should get hike icon from hiking type", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        expect(shareUrlsService.getIconFromType("Hiking")).toBe("icon-hike");
    }));

    it("Should get bike icon from hiking type", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        expect(shareUrlsService.getIconFromType("Biking")).toBe("icon-bike");
    }));

    it("Should get 4x4 icon from hiking type", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        expect(shareUrlsService.getIconFromType("4x4")).toBe("icon-four-by-four");
    }));

    it("Should get unknown icon from unknown type", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        expect(shareUrlsService.getIconFromType("Unknown")).toBe("icon-question");
    }));
});
