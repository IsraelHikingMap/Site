import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { inject, TestBed } from "@angular/core/testing";
import { INatureService } from "./inature.service";

describe("INatureService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting(),
                INatureService
            ]
        });
    });

    it("Should enritch feature from iNature", inject([INatureService, HttpTestingController], 
        async (service: INatureService, mockBackend: HttpTestingController) => {
        const feature = {
            properties: {
                "ref:IL:inature": "123"
            }
        } as any;
        const content = "content";
        const title = "title";
        const response = {
            query: {
                pages: {
                    "123": {
                        title: title,
                        revisions: [{
                            "*": "נצ=1.2,2.3\nסקירה=description\nתמונה=image"
                        }],
                        extract: content
                    }
                }
            }
        };
        // Act
        const promise = service.enritchFeatureFromINature(feature);
        mockBackend.match(r => r.url.includes("https://inature.info/w/api.php"))[0].flush(response);
        // Assert
        await promise;
        expect(feature.properties.image).toBe("https://inature.info/w/index.php?title=Special:Redirect/file/image");

    }));

    it("Should create feature from page id that contain a share", inject([INatureService, HttpTestingController], 
        async (service: INatureService, mockBackend: HttpTestingController) => {
        const pageId = "123";
        const content = "content";
        const title = "title";
        const response = {
            query: {
                pages: {
                    "123": {
                        title: title,
                        revisions: [{
                            "*": "נצ=1.2,2.3\nסקירה=description\nתמונה=image\nisraelhiking.osm.org.il/share/42'"
                        }],
                        extract: content
                    }
                }
            }
        };
        // Act
        const promise = service.createFeatureFromPageId(pageId);
        // Assert
        mockBackend.match(r => r.url.includes("https://inature.info/w/api.php"))[0].flush(response);
        await new Promise(resolve => setTimeout(resolve, 0));
        mockBackend.match(r => r.url.includes("42"))[0].flush({features: [{type: "Feature", geometry: {type: "LineString", coordinates: [[1, 1], [2, 2]]}}]});
        
        const result = await promise;
        expect(result.geometry).toEqual({
            type: "LineString",
            coordinates: [[1,1], [2,2]]
        });
        expect(result.properties["poiExternalDescription:he"]).toBe("description");
        expect(result.properties.poiSource).toBe("iNature");
        expect(result.properties.poiCategory).toBe("Hiking");
        expect(result.properties.poiId).toBe("iNature_123");
        expect(result.properties.identifier).toBe("123");
        expect(result.properties.name).toContain("title");
        expect(result.properties.poiIcon).toBe("icon-hike");
        expect(result.properties.poiIconColor).toBe("black");
        expect(result.properties.image).toBe("https://inature.info/w/index.php?title=Special:Redirect/file/image");
    }));

    it("Should create feature from page id", inject([INatureService, HttpTestingController], 
        async (service: INatureService, mockBackend: HttpTestingController) => {
        const pageId = "123";
        const content = "content";
        const title = "title";
        const response = {
            query: {
                pages: {
                    "123": {
                        title: title,
                        revisions: [{
                            "*": "נצ=1.2,2.3\nסקירה=description\nתמונה=image"
                        }],
                        extract: content
                    }
                }
            }
        };
        // Act
        const promise = service.createFeatureFromPageId(pageId);
        // Assert
        mockBackend.match(r => r.url.includes("https://inature.info/w/api.php"))[0].flush(response);
        
        const result = await promise;
        expect(result.geometry).toEqual({
            type: "Point",
            coordinates: [2.3, 1.2]
        });
        expect(result.properties["poiExternalDescription:he"]).toBe("description");
        expect(result.properties.poiSource).toBe("iNature");
        expect(result.properties.poiCategory).toBe("iNature");
        expect(result.properties.poiId).toBe("iNature_123");
        expect(result.properties.identifier).toBe("123");
        expect(result.properties.name).toContain("title");
        expect(result.properties.poiIcon).toBe("icon-inature");
        expect(result.properties.poiIconColor).toBe("#116C00");
        expect(result.properties.image).toBe("https://inature.info/w/index.php?title=Special:Redirect/file/image");
    }));
});