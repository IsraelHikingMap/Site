import { describe, beforeEach, vi, it, expect } from "vitest";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { inject, TestBed } from "@angular/core/testing";
import { provideRouter } from "@angular/router";
import { provideStore } from "@ngxs/store";

import { ImageAttributionService, type ImageAttribution } from "./image-attribution.service";
import { Urls } from "../urls";
import { ResourcesService } from "./resources.service";

describe("ImageAttributionService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ImageAttributionService,
                provideStore([]),
                provideRouter([]),
                {
                    provide: ResourcesService, useValue: {
                        getCurrentLanguageCodeSimplified: () => "he"
                    }
                },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("should return null when getting null", inject([ImageAttributionService], async (service: ImageAttributionService) => {
        const response = await service.getAttributionForImage(null);
        expect(response).toBeNull();
    }));

    it("should return null when getting base64 image", inject([ImageAttributionService], async (service: ImageAttributionService) => {
        const response = await service.getAttributionForImage("data:image/jpeg;base64,LzlqLzRBQ...");
        expect(response).toBeNull();
    }));

    it("should return a site when getting a site", inject([ImageAttributionService], async (service: ImageAttributionService) => {
        const response = await service.getAttributionForImage("https://www.example.com/image.png");
        expect(response).not.toBeNull();
        expect(response.author).toBe("https://www.example.com");
        expect(response.url).toBe("https://www.example.com");
    }));

    it("should return only valid image urls", inject([ImageAttributionService], (service: ImageAttributionService) => {
        const feature = {
            properties: {
                image: "File:123.jpg",
                image1: "www.wikimedia.org/Building_no_free_image_yet",
                image2: "www.wikimedia.org/svg.png",
                image3: "www.wikimedia.org/svg",
                image4: "www.wikimedia.org/good-image.png",
                image5: "inature.info/image.jpg",
                image6: "nakeb.co.il/image.jpg",
                image7: "jeepolog.com/image.jpg",
                image8: "invalid-url",
                image9: "https://example.com/image4.gif",
                image10: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
                image11: "israelhiking.osm.org.il/inmage.jpg",
                image12: "mapeak.com/image.jpg"
            }
        } as unknown as GeoJSON.Feature;
        const validUrls = service.getValidImageUrls(feature);
        expect(validUrls).toEqual([
            "File:123.jpg",
            "www.wikimedia.org/good-image.png",
            "inature.info/image.jpg",
            "nakeb.co.il/image.jpg",
            "jeepolog.com/image.jpg",
            "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA",
            "israelhiking.osm.org.il/inmage.jpg",
            "mapeak.com/image.jpg"
        ]);
    }));

    it("should return the images of the feature followed by the images of the different sources", inject([ImageAttributionService],
        async (service: ImageAttributionService) => {
            const feature = {
                properties: {
                    image: "File:123.jpg",
                    panoramax: "93a6d34d-14b4-4be3-bc92-1ae93b51260e",
                    wikimedia_commons: "File:From_commons.jpg;Category:Some_Category"
                }
            } as unknown as GeoJSON.Feature;
            vi.spyOn(service, "getAttributionForImage").mockReturnValue(Promise.resolve("aaa") as unknown as Promise<ImageAttribution>);

            expect(await service.getImagesThatHaveAttribution(feature)).toEqual([
                "File:123.jpg",
                "https://api.panoramax.xyz/api/pictures/93a6d34d-14b4-4be3-bc92-1ae93b51260e/sd.jpg",
                "File:From_commons.jpg"
            ]);
        }
    ));
    it("should filter out images that have no attribution", inject([ImageAttributionService],
        async (service: ImageAttributionService) => {
            const feature = {
                type: "Feature",
                properties: {
                    poiSource: "OSM",
                    poiId: "poiId",
                    identifier: "id",
                    image: "wikimedia.org/image-url",
                    image1: "wikimedia.org/image-url1",
                    image2: "wikimedia.org/image-url2"
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 2]
                }
            } as GeoJSON.Feature;
            vi.spyOn(service, "getAttributionForImage")
                .mockReturnValueOnce(Promise.resolve(null))
                .mockReturnValueOnce(Promise.resolve("aaa") as unknown as Promise<ImageAttribution>)
                .mockReturnValueOnce(Promise.resolve(null));

            const imagesUrls = await service.getImagesThatHaveAttribution(feature);
            expect(imagesUrls.length).toBe(1);
            expect(imagesUrls[0]).toBe("wikimedia.org/image-url1");
        }
    ));

    it("should deduplicate images with the same url", inject([ImageAttributionService],
        async (service: ImageAttributionService) => {
            const feature = {
                type: "Feature",
                properties: {
                    poiSource: "OSM",
                    poiId: "poiId",
                    identifier: "id",
                    image: "wikimedia.org/image-url()",
                    image1: encodeURIComponent("wikimedia.org/image-url()")
                },
                geometry: {
                    type: "Point",
                    coordinates: [1, 2]
                }
            } as GeoJSON.Feature;
            vi.spyOn(service, "getAttributionForImage").mockReturnValue(Promise.resolve("aaa") as unknown as Promise<ImageAttribution>);

            const imagesUrls = await service.getImagesThatHaveAttribution(feature);
            expect(imagesUrls.length).toBe(1);
            expect(imagesUrls[0]).toBe("wikimedia.org/image-url()");
        }
    ));

    it("should delegate to the source that claims the image and only ask it once", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
            const pictureId = "93a6d34d-14b4-4be3-bc92-1ae93b51260e";
            const imageUrl = `https://api.panoramax.xyz/api/pictures/${pictureId}/sd.jpg`;
            const promise = service.getAttributionForImage(imageUrl);
            mockBackend.match(r => r.url.startsWith(Urls.panoramaxSearch))[0].flush({
                features: [{ id: pictureId, providers: [{ name: "Some Uploader", roles: ["producer"] }] }]
            });
            await promise;

            const response = await service.getAttributionForImage(imageUrl);
            mockBackend.expectNone(r => r.url.startsWith(Urls.panoramaxSearch));
            expect(response.author).toBe("Some Uploader");
            expect(response.url).toBe(`https://api.panoramax.xyz/#focus=pic&pic=${pictureId}`);
        }
    ));

    it("should keep an image url that can not be decoded as it is", inject([ImageAttributionService],
        async (service: ImageAttributionService) => {
            const feature = {
                properties: { image: "https://www.nakeb.co.il/100%-image.jpg" }
            } as unknown as GeoJSON.Feature;

            expect(await service.getImagesThatHaveAttribution(feature)).toEqual(["https://www.nakeb.co.il/100%-image.jpg"]);
        }
    ));
});
