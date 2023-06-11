import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgxsModule, Store } from "@ngxs/store";

import { ShareUrlsService } from "./share-urls.service";
import { WhatsAppService } from "./whatsapp.service";
import { HashService } from "./hash.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { DatabaseService } from "./database.service";
import { ShareUrlsReducer } from "../reducers/share-urls.reducer";
import { Urls } from "../urls";
import type { ShareUrl, DataContainer } from "../models/models";

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
            info: () => {}
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                NgxsModule.forRoot([ShareUrlsReducer])
            ],
            providers: [
                { provide: HashService, useValue: hashService },
                { provide: LoggingService, useValue: loggingService },
                { provide: DatabaseService, useValue: databaseService },
                RunningContextService,
                WhatsAppService,
                ShareUrlsService
            ]
        });
    });

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
            async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            const promise = shareUrlsService.getImagePreview({} as DataContainer).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.images).flush(new Blob());
            return promise;
        }));
});
