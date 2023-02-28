import { HttpClientModule } from "@angular/common/http";
import { HttpClientTestingModule, HttpTestingController } from "@angular/common/http/testing";
import { inject, TestBed } from "@angular/core/testing";

import { ImageAttributionService } from "./image-attribution.service";
import { ResourcesService } from "./resources.service";

describe("ImageAttributionService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [
                HttpClientModule,
                HttpClientTestingModule
            ],
            providers: [
                { provide: ResourcesService, useValue: { getCurrentLanguageCodeSimplified: () => "en" } },
                ImageAttributionService
            ]
        });
    });

    it("should return null when getting null", inject([ImageAttributionService], async (service: ImageAttributionService) => {
        let response = await service.getAttributionForImage(null);
        expect(response).toBeNull();
    }));

    it("should return null when getting base64 image", inject([ImageAttributionService], async (service: ImageAttributionService) => {
        let response = await service.getAttributionForImage("data:image/jpeg;base64,LzlqLzRBQ...");
        expect(response).toBeNull();
    }));

    it("should return a site when getting a site", inject([ImageAttributionService], async (service: ImageAttributionService) => {
        let response = await service.getAttributionForImage("https://www.example.com/image.png");
        expect(response).not.toBeNull();
        expect(response.author).toBe("https://www.example.com");
        expect(response.url).toBe("https://www.example.com");
    }));

    it("should fetch data from wikipedia when getting wikimedia image", inject([ImageAttributionService, HttpTestingController], 
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        let promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Israel_Hiking_Map_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://en.wikipedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
                                AttributionRequired: {
                                    value: "true"
                                },
                                Artist: {
                                    value: "hello"
                                }
                            }
                        }]
                    }
                }
            }
        });

        let response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("hello");
        expect(response.url).toBe("https://en.wikipedia.org/wiki/File:Israel_Hiking_Map_Image.jpeg");
    }));

    it("should return null when getting wikimedia image without need for attributnio", inject([ImageAttributionService, HttpTestingController], 
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        let promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Israel_Hiking_Map_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://en.wikipedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
                                AttributionRequired: {
                                    value: "false"
                                },
                                Artist: {
                                    value: "hello"
                                }
                            }
                        }]
                    }
                }
            }
        });

        let response = await promise;

        expect(response).toBeNull();
    }));
});
