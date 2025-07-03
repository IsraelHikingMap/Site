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
import { ConnectionService } from "./connection.service";
import { MapService } from "./map.service";
import { AddShareUrlAction, RemoveShareUrlAction, ShareUrlsReducer, UpdateShareUrlAction } from "../reducers/share-urls.reducer";
import { SetShareUrlsLastModifiedDateAction } from "../reducers/offline.reducer";
import { Urls } from "../urls";
import type { ShareUrl } from "../models/models";

describe("Share Urls Service", () => {
    beforeEach(() => {
        const hashService = {
            getFullUrlFromShareId: jasmine.createSpy("getFullUrlFromShareId")
        };
        const databaseService = {
            getShareUrlById: () => {},
            storeShareUrl: () => {},
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
                { provide: ConnectionService, useValue: { stateChanged: { subscribe: () => {} }} },
                { provide: MapService, useValue: { map: { getCanvas: () => ({ toDataURL: () => "url" })}}},
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
    }));

    it("Should sync urls when initializing", inject([ShareUrlsService, HttpTestingController, Store],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, store: Store) => {
            const spy = jasmine.createSpy();
            store.dispatch = spy;
            store.reset({
                userState: {
                    userInfo: {}
                },
                offlineState: {
                    shareUrlsLastModifiedDate: null
                },
                shareUrlsState: {
                    shareUrls: [{
                        id: "1"
                    }, {
                        id: "2"
                    }]
                }
            })
            const promise = shareUrlsService.initialize();

            mockBackend.expectOne(Urls.urls).flush([{
                id: "2"
            }, {
                id: "3"
            }]);
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "2").flush({});

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "3").flush({});

            expect(spy.calls.all()[0].args[0]).toBeInstanceOf(UpdateShareUrlAction);
            expect(spy.calls.all()[1].args[0]).toBeInstanceOf(AddShareUrlAction);
            expect(spy.calls.all()[2].args[0]).toBeInstanceOf(RemoveShareUrlAction);
            expect(spy.calls.all()[3].args[0]).toBeInstanceOf(SetShareUrlsLastModifiedDateAction);

            return promise;
    }));

    it("Should get display name only for the title", inject([ShareUrlsService], (shareUrlService: ShareUrlsService) => {
        expect(shareUrlService.getShareUrlDisplayName({title: "title"} as ShareUrl)).toBe("title");
    }));

    it("Should get display name for title and description", inject([ShareUrlsService], (shareUrlService: ShareUrlsService) => {
        const displayName = shareUrlService.getShareUrlDisplayName({title: "title", description: "desc"} as ShareUrl);
        expect(displayName).toContain("title");
        expect(displayName).toContain("desc");
    }));

    it("Should get social links", inject([ShareUrlsService], (shareUrlService: ShareUrlsService) => {
        const links = shareUrlService.getShareSocialLinks({title: "title", description: "desc"} as ShareUrl);
        expect(links.facebook).toContain(Urls.facebook);
    }));

    it("Should get share url from database when already cached and don't refresh it if it's not newer", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => Promise.resolve({ lastModifiedDate: new Date() } as ShareUrl);
            
            const promise = shareUrlsService.getShareUrl("5");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "5/timestamp").flush(new Date(0).toISOString());

            expect(() => mockBackend.expectNone(Urls.urls)).not.toThrow();
            return promise;
    }));

    it("Should get share url server if not cached", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => null;
            
            const promise = shareUrlsService.getShareUrl("6");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "6").flush({});

            const response = await promise;
            expect(response).toBeDefined();
            return promise;
    }));

    it("Should get share url from database when already cached and try to refresh it since it's newer", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => Promise.resolve({ lastModifiedDate: new Date(100)} as ShareUrl);
            
            const promise = shareUrlsService.getShareUrl("7");

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            mockBackend.expectOne(Urls.urls + "7/timestamp").flush(new Date(200).toISOString());

            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(() => mockBackend.expectOne(Urls.urls + "7").flush({})).not.toThrow();
            return promise;
    }));

    it("Should get share url from database when already cached and try to refresh twice it since it's newer and first fast refresh failed", inject([ShareUrlsService, HttpTestingController, DatabaseService],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService) => {

            databaseService.getShareUrlById = () => Promise.resolve({ lastModifiedDate: new Date(100)} as ShareUrl);
            
            const promise = shareUrlsService.getShareUrl("7");
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            mockBackend.expectOne(Urls.urls + "7/timestamp").flush(new Date(200).toISOString());
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await
            mockBackend.expectOne(Urls.urls + "7").flush(null, { status: 500, statusText: "Internal Server Error" });
            await new Promise((resolve) => setTimeout(resolve, 100)); // this is in order to let the code continue to run to the next await

            expect(() => mockBackend.expectOne(Urls.urls + "7").flush({})).not.toThrow();
            return promise;
    }));

    it("Should create share url", inject([ShareUrlsService, HttpTestingController],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            const shareUrl = { id: "42" } as ShareUrl;

            const promise = shareUrlsService.createShareUrl(shareUrl).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.urls).flush({});
            return promise;
    }));

    it("Should update share url", inject([ShareUrlsService, HttpTestingController],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            const shareUrl = { id: "42" } as ShareUrl;

            const promise = shareUrlsService.updateShareUrl(shareUrl).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            return promise;
    }));

    it("Should delete share url", inject([ShareUrlsService, HttpTestingController, DatabaseService, Store],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController, databaseService: DatabaseService, store: Store) => {

            const shareUrl = { id: "42" } as ShareUrl;
            store.dispatch = jasmine.createSpy();
            const promise = shareUrlsService.deleteShareUrl(shareUrl).then(() => {

                expect(store.dispatch).toHaveBeenCalled();
                expect(databaseService.deleteShareUrlById).toHaveBeenCalled();
            });

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            return promise;
        }));

    it("Should get image for share url", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        const shareUrl = { id: "42" } as ShareUrl;
        const imageUrl = shareUrlsService.getImageFromShareId(shareUrl);

        expect(imageUrl).toContain(shareUrl.id);
    }));

    it("Should get image preview by sending a request to server",
        inject([ShareUrlsService, HttpTestingController],
            async (shareUrlsService: ShareUrlsService) => {

            const res = shareUrlsService.getImagePreview();

            expect(res).not.toBeNull();
        }));
});
