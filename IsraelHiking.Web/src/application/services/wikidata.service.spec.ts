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
                { provide: ResourcesService, useValue: {
                    getCurrentLanguageCodeSimplified: () => "he",
                    noDescriptionAvailableInYourLanguage: "noDescriptionAvailableInYourLanguage"
                } },
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
        backend.expectOne(r => r.url.startsWith(`https://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&explaintext=&titles=${title}`)).flush({
            query: {
                pages: { 
                    "1": {
                        extract: "external descriptiopn",
                        original: {
                            source: "image-url2"
                        }
                    },
                }
            }
        });
        
        const feature = await promise;
        expect(feature.properties.image).toBe("image-url");
        expect(feature.properties.image1).toBe("image-url2");
        expect(feature.properties.name).toBe(title);
        expect(feature.properties.poiExternalDescription).toBe("external descriptiopn");
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2,1]);
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
        
        const feature = await promise;
        expect(feature.properties["name:en"]).toBe(title);
        expect(feature.properties.name).toBe(title);
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2,1]);
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
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2,1]);
    }));


    it("should create a feature from wikidata page id without image, links and description", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const language = "he";
        const promise = serive.createFeatureFromPageId(wikidataId, language);

        backend.expectOne(r => r.url === `https://www.wikidata.org/w/rest.php/wikibase/v1/entities/items/${wikidataId}`).flush({
            sitelinks: {},
            statements: {
                P625: [{
                    value: {
                        content: {
                            latitude: 1,
                            longitude: 2
                        }
                    }
                }],
            }
        });
        await new Promise((resolve) => setTimeout(resolve, 10));
        
        const feature = await promise;
        expect(feature.properties.image).toBeUndefined();
        expect(feature.properties.name).toBeUndefined();
        expect(feature.properties["description:" + language]).toBeDefined();
        expect(feature.geometry.type).toBe("Point");
        expect((feature.geometry as GeoJSON.Point).coordinates).toEqual([2,1]);
    }));

    it("should enritch feature that does not link to valid pages", inject([WikidataService, HttpTestingController], async (serive: WikidataService, backend: HttpTestingController) => {
        const wikidataId = "Q123";
        const imageName = "image_name";
        const language = "he";
        const title = "he-test";
        const feature: GeoJSON.Feature = { 
            type: "Feature", 
            geometry: { 
                type: "Point", 
                coordinates: [1,2]
            },
            properties: {
                wikidata: wikidataId
            } as any
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
        backend.expectOne(r => r.url.startsWith(`https://${language}.wikipedia.org/w/api.php?format=json&action=query&prop=extracts|pageimages&piprop=original&exintro=&explaintext=&titles=${title}`)).flush({
            query: {
                pages: {}
            }
        });
        
        await promise;
        expect(feature.properties.image).toBeUndefined();
        expect(feature.properties["description:" + language]).toBeUndefined();
    }));
})