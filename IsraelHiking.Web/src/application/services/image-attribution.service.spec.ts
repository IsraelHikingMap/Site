import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { inject, TestBed } from "@angular/core/testing";

import { ImageAttributionService } from "./image-attribution.service";

describe("ImageAttributionService", () => {

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                ImageAttributionService,
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

    it("should fetch data from wikimedia when getting wikimedia image", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
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

        const response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("hello");
        expect(response.url).toBe("https://commons.wikimedia.org/wiki/File:IHM_Image.jpeg");
    }));

    it("should fetch data from wikimedia when getting wikimedia file", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        const promise = service.getAttributionForImage("File:123.jpeg");
        mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
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

        const response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("hello");
        expect(response.url).toBe("https://commons.wikimedia.org/wiki/File:123.jpeg");
    }));

    it("should remove html tags and get the value inside", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
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

        const response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("hello");
        expect(response.url).toBe("https://commons.wikimedia.org/wiki/File:IHM_Image.jpeg");
    }));

    it("should remove html tags, tabs and get the value inside", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            extmetadata: {
                                Artist: {
                                    value: "<span>\thello\tworld</span>"
                                }
                            }
                        }]
                    }
                }
            }
        });

        const response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("hello world");
        expect(response.url).toBe("https://commons.wikimedia.org/wiki/File:IHM_Image.jpeg");
    }));

    // Based on https://upload.wikimedia.org/wikipedia/commons/b/b5/Historical_map_series_for_the_area_of_Al-Manara%2C_Palestine_%281870s%29.jpg
    it("should remove html tags and get the value inside for multiple html tags", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
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

        const response = await promise;

        expect(response).not.toBeNull();
        expect(response.author).toBe("Sources for historical series of maps as follows:\n" +
                                     "PEF Survey of Palestine\n" +
                                     "Survey of PalestineOverlay from Palestine Open Maps\n" +
                                     "OpenStreetMap");
        expect(response.url).toBe("https://commons.wikimedia.org/wiki/File:IHM_Image.jpeg");
    }));

    it("should return null when getting wikimedia image without artist", inject([ImageAttributionService, HttpTestingController],
        async (service: ImageAttributionService, mockBackend: HttpTestingController) => {
        const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
        mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
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

        const response = await promise;

        expect(response).toBeNull();
    }));
});
