import { describe, beforeEach, afterEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { UserImagesService } from "./user-images.service";
import { Urls } from "../urls";

describe("UserImagesService", () => {

    const imageId = "3a7f9c2e1b4d0a95f60c2d3e4f501b6c";
    const imageUrl = `${Urls.userImages}/${imageId}.jpg`;
    const metadataUrl = `${Urls.userImages}/${imageId}.json`;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                UserImagesService,
                provideHttpClient(),
                provideHttpClientTesting()
            ]
        });
    });

    afterEach(inject([HttpTestingController], (mockBackend: HttpTestingController) => {
        mockBackend.verify();
    }));

    it("should claim the images it holds", inject([UserImagesService], (service: UserImagesService) => {
        expect(service.isImageUrl(imageUrl)).toBeTruthy();
        expect(service.isImageUrl(`${Urls.userImages}/${imageId}.png`)).toBeTruthy();
        expect(service.isImageUrl(`${imageUrl}?width=250`)).toBeTruthy();
    }));

    it("should not claim an image of another source", inject([UserImagesService], (service: UserImagesService) => {
        expect(service.isImageUrl("https://upload.wikimedia.org/image.jpeg")).toBeFalsy();
        expect(service.isImageUrl(null)).toBeFalsy();
    }));

    it("should not claim an address of ours that is not an image", inject([UserImagesService], (service: UserImagesService) => {
        expect(service.isImageUrl(`${Urls.userImages}/not-an-id.jpg`)).toBeFalsy();
        expect(service.isImageUrl(`${Urls.userImages}/${imageId}.gif`)).toBeFalsy();
    }));

    it("should credit the user that uploaded an image and link to the page of the image", inject([UserImagesService, HttpTestingController],
        async (service: UserImagesService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.expectOne(metadataUrl).flush({ osmUser: "Harel M", license: "CC0-1.0" });

            const attribution = await promise;
            expect(attribution.author).toBe("Harel M");
            expect(attribution.url).toBe(`${Urls.userImages}/${imageId}`);
        }
    ));

    it("should credit a resized image the same way it credits the original", inject([UserImagesService, HttpTestingController],
        async (service: UserImagesService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(`${imageUrl}?width=250`);
            mockBackend.expectOne(metadataUrl).flush({ osmUser: "Harel M" });

            expect((await promise).url).toBe(`${Urls.userImages}/${imageId}`);
        }
    ));

    it("should return null attribution for an image of another source", inject([UserImagesService],
        async (service: UserImagesService) => {
            expect(await service.getAttributionForImage("https://upload.wikimedia.org/image.jpeg")).toBeNull();
        }
    ));

    it("should return null attribution when the image does not exist", inject([UserImagesService, HttpTestingController],
        async (service: UserImagesService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.expectOne(metadataUrl).flush("", { status: 404, statusText: "Not Found" });

            expect(await promise).toBeNull();
        }
    ));
});
