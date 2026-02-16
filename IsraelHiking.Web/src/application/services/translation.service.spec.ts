import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { TranslationResponse, TranslationService } from "./translation.service";
import { ResourcesService } from "./resources.service";
import { Urls } from "../urls";

describe("TranslationService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                TranslationService,
                {
                    provide: ResourcesService, useValue: {
                        getCurrentLanguageCodeSimplified: () => "he",
                    }
                },
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("return false if translation is not needed because of available language description", inject([TranslationService], (service: TranslationService) => {
        const isTranslationNeeded = service.isTranslationPossibleAndNeeded({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:he": "תיאור בעברית"
            }
        } as GeoJSON.Feature);
        expect(isTranslationNeeded).toBeFalse();
    }));

    it("return false if translation is not needed beacuse of external description", inject([TranslationService], (service: TranslationService) => {
        const isTranslationNeeded = service.isTranslationPossibleAndNeeded({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "poiExternalDescription:he": "External description",
                description: "Original description"
            }
        } as GeoJSON.Feature);
        expect(isTranslationNeeded).toBeFalse();
    }));

    it("return false if translation is not possible", inject([TranslationService], (service: TranslationService) => {
        const isTranslationPossible = service.isTranslationPossibleAndNeeded({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {}
        } as GeoJSON.Feature);
        expect(isTranslationPossible).toBeFalse();
    }));

    it("return true if translation is possible and needed in original language", inject([TranslationService], (service: TranslationService) => {
        const isTranslationPossible = service.isTranslationPossibleAndNeeded({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                description: "Original description"
            }
        } as GeoJSON.Feature);
        expect(isTranslationPossible).toBeTrue();
    }));

    it("return true if translation is possible and needed in english", inject([TranslationService], (service: TranslationService) => {
        const isTranslationPossible = service.isTranslationPossibleAndNeeded({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:en": "Description in English"
            }
        } as GeoJSON.Feature);
        expect(isTranslationPossible).toBeTrue();
    }));

    it("return true if translation is possible by external translation from another language", inject([TranslationService], (service: TranslationService) => {
        const isTranslationPossible = service.isTranslationPossibleAndNeeded({
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "poiExternalDescription:en": "External description",
            }
        } as GeoJSON.Feature);
        expect(isTranslationPossible).toBeTrue();
    }));

    it("should return the best description from relevant language", inject([TranslationService], (service: TranslationService) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:he": "תיאור בעברית",
                poiExternalDescription: "External description",
                description: "Original description",
                "description:en": "Description in English"
            }
        };
        const bestDescription = service.getBestDescription(feature);
        expect(bestDescription).toBe("תיאור בעברית");
    }));

    it("should return the best description from external description in relevant language", inject([TranslationService], (service: TranslationService) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "poiExternalDescription:he": "External description",
                description: "Original description",
                "description:en": "Description in English"
            }
        };
        const bestDescription = service.getBestDescription(feature);
        expect(bestDescription).toBe("External description");
    }));

    it("should return the best description from description in original language", inject([TranslationService], (service: TranslationService) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                description: "Original description",
                "description:en": "Description in English"
            }
        };
        const bestDescription = service.getBestDescription(feature);
        expect(bestDescription).toBe("Original description");
    }));

    it("should return the best description from description in english", inject([TranslationService], (service: TranslationService) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:en": "Description in English"
            }
        };
        const bestDescription = service.getBestDescription(feature);
        expect(bestDescription).toBe("Description in English");
    }));

    it("should return the best description from external description in any language", inject([TranslationService], (service: TranslationService) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "poiExternalDescription:ar": "External description in Arabic"
            }
        };
        const bestDescription = service.getBestDescription(feature);
        expect(bestDescription).toBe("External description in Arabic");
    }));

    it("should return empty string if no relevant description is available", inject([TranslationService], (service: TranslationService) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:ar": "Description in Arabic"
            }
        };
        const bestDescription = service.getBestDescription(feature);
        expect(bestDescription).toBe("");
    }));

    it("should return empty string if description is empty", inject([TranslationService, HttpTestingController], async (service: TranslationService, backend: HttpTestingController) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:en": ""
            },
        };
        const promise = service.getTranslatedDescription(feature);

        backend.expectNone(req => req.method === "POST" && req.url === Urls.tranlation);

        const translation = await promise;
        expect(translation).toBe("");
    }));

    it("should get a description translation", inject([TranslationService, HttpTestingController], async (service: TranslationService, backend: HttpTestingController) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                "description:en": "Description in English"
            },
        };
        const promise = service.getTranslatedDescription(feature);

        backend.expectOne(req => req.method === "POST" && req.url === Urls.tranlation).flush({
            translatedText: "Translated Description",
        } as TranslationResponse);

        const translation = await promise;
        expect(translation).toBe("Translated Description");
    }));

    it("should get a description translation from cache", inject([TranslationService, HttpTestingController], async (service: TranslationService, backend: HttpTestingController) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                poiId: "12345",
                "description:en": "Description in English"
            },
        };
        const promise = service.getTranslatedDescription(feature);

        backend.expectOne(req => req.method === "POST" && req.url === Urls.tranlation).flush({
            translatedText: "Translated Description",
        } as TranslationResponse);

        const translation = await promise;
        const translation2 = await service.getTranslatedDescription(feature);
        expect(translation).toBe("Translated Description");
        expect(translation2).toBe("Translated Description");
    }));

    it("should return empty string in case of error", inject([TranslationService, HttpTestingController], async (service: TranslationService, backend: HttpTestingController) => {
        const feature: GeoJSON.Feature = {
            type: "Feature",
            geometry: {
                type: "Point",
                coordinates: [0, 0]
            },
            properties: {
                poiId: "12345",
                "description:en": "Description in English"
            },
        };
        const promise = service.getTranslatedDescription(feature);

        backend.expectOne(req => req.method === "POST" && req.url === Urls.tranlation).flush({}, { status: 500, statusText: "Server Error" });

        const translation = await promise;
        expect(translation).toBe("");
    }));
});