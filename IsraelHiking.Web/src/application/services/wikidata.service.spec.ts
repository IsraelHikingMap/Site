import { describe, beforeEach, it, expect } from "vitest";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { inject, TestBed } from "@angular/core/testing";

import { WikidataService } from "./wikidata.service";
import { ResourcesService } from "./resources.service";

describe("WikidataService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                WikidataService,
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

    it("should create a feature from wikidata page id with all the relevant data", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const imageName = "image_name";
        const language = "he";
        const title = "he-test";
        const promise = serive.createFeatureFromPageId(wikidataId, language);

        backend.expectOne(r => r.url === `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`).flush({
            sitelinks: {
                hewiki: {
                    title
                }
            },
            statements: {
                P625: [{
                    value: {
                        content: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }],
                P18: [{
                    value: {
                        content: imageName
                    }
                }]
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        backend.expectOne(r => r.url.startsWith(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${imageName}`)).flush({
            query: {
                pages: {
                    "-1": {
                        imageinfo: [{
                            url: "image-url"
                        }]
                    }
                }
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        backend.expectOne(r => r.url.startsWith(`https://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&redirects=1&explaintext=&titles=${title}`)).flush({
            query: {
                pages: {
                    "1": {
                        extract: "external descriptiopn",
                        original: {
                            source: "image-url2"
                        }
                    }
                }
            }
        });

        const feature = await promise;
        expect(feature.properties.identifier).toBe(wikidataId);
        expect(feature.properties.poiId).toBe("Wikidata_" + wikidataId);
        expect(feature.properties.poiSource).toBe("Wikidata");
        expect(feature.properties.image).toBe("image-url");
        expect(feature.properties.image1).toBe("image-url2");
        expect(feature.properties.name).toBe(title);
        expect(feature.properties["poiExternalDescription:" + language]).toBe("external descriptiopn");
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2, 1]);
    }));

    it("should create a feature from wikidata page id english title", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const language = "he";
        const title = "en-test";
        const promise = serive.createFeatureFromPageId(wikidataId, language);

        backend.expectOne(r => r.url === `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`).flush({
            sitelinks: {
                enwiki: {
                    title
                }
            },
            statements: {
                P625: [{
                    value: {
                        content: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }]
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        backend.expectOne(r => r.url === `https://en.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&redirects=1&explaintext=&titles=${title}&origin=*`).flush({
            query: {
                pages: {
                    "1": {
                        extract: "external description",
                        original: {
                            source: "image-url2"
                        }
                    }
                }
            }
        });

        const feature = await promise;
        expect(feature.properties["name:en"]).toBe(title);
        expect(feature.properties.name).toBe(title);
        expect(feature.properties["description:en"]).toBe("external description");
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2, 1]);
    }));

    it("should create a feature from wikidata page id with title from label", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const language = "he";
        const title = "en-test";
        const promise = serive.createFeatureFromPageId(wikidataId, language);

        backend.expectOne(r => r.url === `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`).flush({
            labels: {
                en: title,
                mul: "default-name"
            },
            sitelinks: {},
            statements: {
                P625: [{
                    value: {
                        content: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }]
            }
        });

        const feature = await promise;
        expect(feature.properties["name:en"]).toBe(title);
        expect(feature.properties.name).toBe("default-name");
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2, 1]);
    }));


    it("should create a feature from wikidata page id without image and links but with description", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const language = "he";
        const promise = serive.createFeatureFromPageId(wikidataId, language);

        backend.expectOne(r => r.url === `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`).flush({
            sitelinks: {},
            descriptions: {
                he: "description"
            },
            statements: {
                P625: [{
                    value: {
                        content: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }]
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));

        const feature = await promise;
        expect(feature.properties.image).toBeUndefined();
        expect(feature.properties.name).toBeUndefined();
        expect(feature.properties["description:" + language]).toBe("description");
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2, 1]);
    }));

    it("should enrich feature that does not link to valid pages", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const imageName = "image_name";
        const language = "he";
        const title = "he-test";
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [1, 2]
            },
            properties: {
                wikidata: wikidataId
            }
        };
        const promise = serive.enritchFeatureFromWikimedia(feature, language);

        backend.expectOne(r => r.url === `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`).flush({
            sitelinks: {
                hewiki: {
                    title
                }
            },
            statements: {
                P625: [{
                    value: {
                        content: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }],
                P18: [{
                    value: {
                        content: imageName
                    }
                }]
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        backend.expectOne(r => r.url.startsWith(`https://commons.wikimedia.org/w/api.php?action=query&titles=File:${imageName}`)).flush({
            query: {
                pages: {}
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        backend.expectOne(r => r.url.startsWith(`https://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&redirects=1&explaintext=&titles=${title}`)).flush({
            query: {
                pages: {}
            }
        });

        await promise;
        expect(feature.properties.image).toBeUndefined();
        expect(feature.properties["description:" + language]).toBeUndefined();
    }));

    it("should fetch data from wikimedia when getting wikimedia image", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
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
        }
    ));

    it("should fetch attribution from wikimedia when getting wikimedia image with attribution and no author", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
            mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
                query: {
                    pages: {
                        "-1": {
                            imageinfo: [{
                                extmetadata: {
                                    Attribution: {
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
        }
    ));

    it("should fetch attribution from wikimedia when getting wikimedia image with permissive license and no author or attribution", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/Some_Image.jpeg");
            mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
                query: {
                    pages: {
                        "14686480": {
                            imageinfo: [{
                                extmetadata: {
                                    LicenseShortName: {
                                        value: "Cc-by-sa-3.0"
                                    }
                                }
                            }]
                        }
                    }
                }
            });

            const response = await promise;

            expect(response).not.toBeNull();
            expect(response.author).toBe("Unknown");
            expect(response.url).toBe("https://commons.wikimedia.org/wiki/File:Some_Image.jpeg");
        }
    ));

    it("should fetch data from wikimedia when getting wikimedia file", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
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
        }
    ));

    it("should remove html tags and get the value inside", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/he/thumb/a/a1/IHM_Image.jpeg");
            mockBackend.match(r => r.url.startsWith("https://he.wikipedia.org/"))[0].flush({
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
            expect(response.url).toBe("https://he.wikipedia.org/wiki/File:IHM_Image.jpeg");
        }
    ));

    it("should remove html tags, tabs and get the value inside", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
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
        }
    ));

    // Based on https://upload.wikimedia.org/wikipedia/commons/b/b5/Historical_map_series_for_the_area_of_Al-Manara%2C_Palestine_%281870s%29.jpg
    it("should remove html tags and get the value inside for multiple html tags", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
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
        }
    ));

    it("should return null when getting wikimedia image without artist and license", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/something_else.jpeg");
            mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
                query: {
                    pages: {
                        "-1": {
                            imageinfo: [{
                                extmetadata: {
                                    somthing: {}
                                }
                            }]
                        }
                    }
                }
            });

            const response = await promise;

            expect(response).toBeNull();
        }
    ));

    it("should return the author from page content", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
            mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
                query: {
                    pages: {
                        "-1": {
                            imageinfo: [{
                                extmetadata: {
                                    somthing: {}
                                }
                            }],
                            revisions: [{
                                "*": "|author=John Doe\n|date=2023-01-01"
                            }]
                        }
                    }
                }
            });

            const response = await promise;

            expect(response).toBeDefined();
            expect(response.author).toBe("John Doe");
        }
    ));

    it("should return the author from page content that has a link", inject([WikidataService, HttpTestingController],
        async (service: WikidataService, mockBackend: HttpTestingController) => {
            const promise = service.getAttributionForImage("https://upload.wikimedia.org/wikipedia/commons/thumb/a/a1/IHM_Image.jpeg");
            mockBackend.match(r => r.url.startsWith("https://commons.wikimedia.org/"))[0].flush({
                query: {
                    pages: {
                        "-1": {
                            imageinfo: [{
                                extmetadata: {
                                    somthing: {}
                                }
                            }],
                            revisions: [{
                                "*": "|author=[//www.openstreetmap.org/user/osm-user OSM User]"
                            }]
                        }
                    }
                }
            });

            const response = await promise;

            expect(response).toBeDefined();
            expect(response.author).toBe("OSM User");
        }
    ));

    it("should get the images of a feature from its wikimedia_commons tag and ignore categories", inject([WikidataService], (service: WikidataService) => {
        const feature = {
            properties: {
                wikimedia_commons: "File:First.jpg; Category:Some_Category ;File:Second.jpg"
            }
        } as unknown as GeoJSON.Feature;

        expect(service.getImageUrls(feature)).toEqual(["File:First.jpg", "File:Second.jpg"]);
    }));

    it("should not get images from a feature without a wikimedia_commons tag", inject([WikidataService], (service: WikidataService) => {
        expect(service.getImageUrls({ properties: { name: "some name" } } as unknown as GeoJSON.Feature)).toEqual([]);
    }));

    it("should claim wikimedia images but not placeholders and svg files", inject([WikidataService], (service: WikidataService) => {
        expect(service.isImageUrl("File:Some_Image.jpg")).toBeTruthy();
        expect(service.isImageUrl("https://upload.wikimedia.org/wikipedia/commons/a/a1/Image.jpeg")).toBeTruthy();
        expect(service.isImageUrl("https://upload.wikimedia.org/wikipedia/commons/b/b6/Building_no_free_image_yet-he.png")).toBeFalsy();
        expect(service.isImageUrl("https://upload.wikimedia.org/wikipedia/commons/b/b6/1.svg")).toBeFalsy();
        expect(service.isImageUrl("https://upload.wikimedia.org/wikipedia/commons/b/b6/2.svg.png")).toBeFalsy();
        expect(service.isImageUrl("https://www.example.com/image.png")).toBeFalsy();
    }));
})
