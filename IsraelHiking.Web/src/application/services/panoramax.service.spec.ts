import { describe, beforeEach, afterEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { PanoramaxService } from "./panoramax.service";
import { Urls } from "../urls";

function createFeature(properties: Record<string, string>) {
    return {
        type: "Feature",
        properties,
        geometry: { type: "Point", coordinates: [1, 2] }
    } as GeoJSON.Feature;
}

describe("PanoramaxService", () => {

    const pictureId = "93a6d34d-14b4-4be3-bc92-1ae93b51260e";
    const imageUrl = `https://api.panoramax.xyz/api/pictures/${pictureId}/sd.jpg`;

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                PanoramaxService,
                provideHttpClient(),
                provideHttpClientTesting()
            ]
        });
    });

    afterEach(inject([HttpTestingController], (httpMock: HttpTestingController) => {
        httpMock.verify();
    }));

    it("should return the image urls of a panoramax tag, a tag can hold several ids", inject([PanoramaxService], (service: PanoramaxService) => {
        const secondId = "00000000-1111-4222-8333-444444444444";

        expect(service.getImageUrls(createFeature({ panoramax: pictureId }))).toEqual([imageUrl]);
        expect(service.getImageUrls(createFeature({ panoramax: `${pictureId}; ${secondId}` })))
            .toEqual([imageUrl, `https://api.panoramax.xyz/api/pictures/${secondId}/sd.jpg`]);
    }));

    it("should not return image urls when there is no valid panoramax id", inject([PanoramaxService], (service: PanoramaxService) => {
        expect(service.getImageUrls(createFeature({ name: "some name" }))).toEqual([]);
        expect(service.getImageUrls(createFeature({ panoramax: "yes" }))).toEqual([]);
    }));

    it("should only claim panoramax picture urls", inject([PanoramaxService], (service: PanoramaxService) => {
        expect(service.isImageUrl(imageUrl)).toBeTruthy();
        expect(service.isImageUrl("https://upload.wikimedia.org/image.jpeg")).toBeFalsy();
        expect(service.isImageUrl("https://api.panoramax.xyz/api/pictures/not-a-uuid/sd.jpg")).toBeFalsy();
    }));

    it("should return null attribution for a non panoramax image", inject([PanoramaxService], async (service: PanoramaxService) => {
        expect(await service.getAttributionForImage("https://upload.wikimedia.org/image.jpeg")).toBeNull();
    }));

    it("should credit all the producers of an image and link to the viewer", inject([PanoramaxService, HttpTestingController],
        async (service: PanoramaxService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.expectOne(r => r.url.startsWith(Urls.panoramaxSearch)).flush({
                features: [{
                    id: pictureId,
                    providers: [
                        { name: "Uploading Account", roles: ["producer"] },
                        { name: "Some Artist", roles: ["producer"] },
                        { name: "Some Host", roles: ["host"] }
                    ]
                }]
            });

            const attribution = await promise;
            expect(attribution.author).toBe("Uploading Account, Some Artist");
            expect(attribution.url).toBe(`https://api.panoramax.xyz/#focus=pic&pic=${pictureId}`);
        }
    ));

    it("should credit panoramax itself when a picture has no producer", inject([PanoramaxService, HttpTestingController],
        async (service: PanoramaxService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.expectOne(r => r.url.startsWith(Urls.panoramaxSearch)).flush({ features: [{ id: pictureId }] });

            expect((await promise).author).toBe("Panoramax");
        }
    ));

    it("should return null attribution when the picture does not exist", inject([PanoramaxService, HttpTestingController],
        async (service: PanoramaxService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.expectOne(r => r.url.startsWith(Urls.panoramaxSearch)).flush({ features: [] });

            expect(await promise).toBeNull();
        }
    ));

    it("should return null attribution when the request fails", inject([PanoramaxService, HttpTestingController],
        async (service: PanoramaxService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.expectOne(r => r.url.startsWith(Urls.panoramaxSearch))
                .flush("server is down", { status: 500, statusText: "Internal Server Error" });

            expect(await promise).toBeNull();
        }
    ));
});
