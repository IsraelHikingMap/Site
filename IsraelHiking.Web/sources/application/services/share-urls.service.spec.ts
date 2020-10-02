import { TestBed, inject } from "@angular/core/testing";
import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { NgReduxTestingModule } from "@angular-redux/store/testing";
import { Device } from "@ionic-native/device/ngx";

import { ShareUrlsService } from "./share-urls.service";
import { WhatsAppService } from "./whatsapp.service";
import { HashService } from "./hash.service";
import { RunningContextService } from "./running-context.service";
import { LoggingService } from "./logging.service";
import { Urls } from "../urls";
import { ShareUrl, DataContainer } from "../models/models";

describe("Share Urls Service", () => {
    beforeEach(() => {
        let hashService = {
            getFullUrlFromShareId: jasmine.createSpy("getFullUrlFromShareId")
        };
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule,
                NgReduxTestingModule
            ],
            providers: [
                { provide: HashService, useValue: hashService },
                { provide: LoggingService, useValue: {} },
                RunningContextService,
                Device,
                WhatsAppService,
                ShareUrlsService
            ]
        });
    });

    it("Should update share url", inject([ShareUrlsService, HttpTestingController],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            let shareUrl = { id: "42" } as ShareUrl;

            let promise = shareUrlsService.updateShareUrl(shareUrl).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            return promise;
        }));

    it("Should delete share url", inject([ShareUrlsService, HttpTestingController],
        async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            let shareUrl = { id: "42" } as ShareUrl;

            let promise = shareUrlsService.deleteShareUrl(shareUrl);

            mockBackend.expectOne(Urls.urls + shareUrl.id).flush({});
            return promise;
        }));

    it("Should get image for share url", inject([ShareUrlsService], (shareUrlsService: ShareUrlsService) => {
        let shareUrl = { id: "42" } as ShareUrl;
        let imageUrl = shareUrlsService.getImageFromShareId(shareUrl);

        expect(imageUrl).toContain(shareUrl.id);
    }));

    it("Should get image preview by sending a request to server",
        inject([ShareUrlsService, HttpTestingController],
            async (shareUrlsService: ShareUrlsService, mockBackend: HttpTestingController) => {

            let promise = shareUrlsService.getImagePreview({} as DataContainer).then((res) => {
                expect(res).not.toBeNull();
            });

            mockBackend.expectOne(Urls.images).flush(new Blob());
            return promise;
        }));
});
