import { describe, beforeEach, afterEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { NakebMarker, NakebService } from "./nakeb.service";

describe("NakebService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                NakebService,
                provideHttpClient(),
                provideHttpClientTesting()
            ]
        });
    });

    afterEach(inject([HttpTestingController], (httpMock: HttpTestingController) => {
        httpMock.verify();
    }));

    it("should fetch a hike by id and convert it into a GeoJSON feature", inject([NakebService, HttpTestingController], async (service: NakebService, httpMock: HttpTestingController) => {
        const item = {
            id: "42",
            title: "Some Title",
            last_modified: "2024-01-01T00:00:00Z",
            start: { lat: 31.4, lng: 35.3 },
            length: 5000,
            picture: "https://www.nakeb.co.il/eingedi.jpg",
            link: "https://www.nakeb.co.il/hikes/7",
            attributes: ["Easy", "Family"],
            prolog: "A lovely walk",
            latlngs: [{ lat: 1, lng: 2 }, { lat: 3, lng: 4 }],
            markers: [] as NakebMarker[]
        };

        const promise = service.getRoute("7");
        const req = httpMock.expectOne("https://www.nakeb.co.il/api/hikes/7");
        expect(req.request.method).toBe("GET");
        req.flush(item);
        const feature = await promise;

        expect(feature.type).toBe("Feature");
        expect(feature.geometry.type).toBe("LineString");
        expect((feature.geometry as GeoJSON.LineString).coordinates).toEqual([[2, 1], [4, 3]]);

        const properties = feature.properties;
        expect(properties.identifier).toBe("42");
        expect(properties.poiId).toBe("Nakeb_42");
        expect(properties.poiCategory).toBe("Hiking");
        expect(properties.poiIcon).toBe("icon-hike");
        expect(properties.poiIconColor).toBe("black");
        expect(properties.poiSource).toBe("Nakeb");
        expect(properties.poiSourceImageUrl).toBe("https://www.nakeb.co.il/static/images/hikes/logo_1000x667.jpg");
        expect(properties.name).toBe("Some Title");
        expect(properties["name:he"]).toBe("Some Title");
        expect(properties.poiGeolocation).toEqual({ lat: 31.4, lng: 35.3 });
        expect(properties.length).toBe(5000);
        expect(properties.image).toBe("https://www.nakeb.co.il/eingedi.jpg");
        expect(properties.website).toBe("https://www.nakeb.co.il/hikes/7");
        expect(properties.description).toBe("A lovely walk.\nEasy, Family.");
        expect(properties["description:he"]).toBe("A lovely walk.\nEasy, Family.");
    }));
});