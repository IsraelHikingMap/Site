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
        let promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://en.wikipedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
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
        expect(response.url).toBe("https://en.wikipedia.org/wiki/File:IHM_Image.jpeg");
    }));

    it("should remove html tags and get the value inside", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        let promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://en.wikipedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
                                Artist: {
                                    value: "<span>hello</span>"
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
        expect(response.url).toBe("https://en.wikipedia.org/wiki/File:IHM_Image.jpeg");
    }));

    it("should remove html tags and get the value inside for multiple html tags", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        let promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://en.wikipedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
                                Artist: {
                                    value: "<p>Sources for historical series of maps as follows:\n</p>\n<ul><li>" + 
                                        "<a href=\"https://en.wikipedia.org/wiki/PEF_Survey_of_Palestine\"" + 
                                        " class=\"extiw\" title=\"w:PEF Survey of Palestine\">PEF Survey of Palestine" + 
                                        "</a></li>\n<li><a href=\"https://en.wikipedia.org/wiki/Survey_of_Palestine\" " +
                                        "class=\"extiw\" title=\"w:Survey of Palestine\">Survey of Palestine</a></li></ul>" + 
                                        "<p>Overlay from <a rel=\"nofollow\" class=\"external text\" href=\"https://palopenmaps.org\">" +
                                        "Palestine Open Maps</a>\n</p>\n<ul><li><a href=\"https://en.wikipedia.org/wiki/OpenStreetMap\" " + 
                                        "class=\"extiw\" title=\"w:OpenStreetMap\">OpenStreetMap</a></li></ul>"
                                }
                            }
                        }]
                    }
                }
            }
        });

        let response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("Sources for historical series of maps as follows:\n");
        expect(response.url).toBe("https://en.wikipedia.org/wiki/File:IHM_Image.jpeg");
    }));

    it("should return null when getting wikimedia image without artist", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        let promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://en.wikipedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
                                somthing: {},
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
