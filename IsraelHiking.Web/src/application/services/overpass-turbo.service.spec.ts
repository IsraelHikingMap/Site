import { inject, TestBed } from "@angular/core/testing";
import { HttpClient, provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { OverpassTurboService } from "./overpass-turbo.service";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

describe("OverpassTurboService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            imports: [],
            providers: [
                OverpassTurboService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get a long way by name", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "name", false, false);

        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);
        // Assert
        const results = await promise;
        expect(results.features.length).toBe(0);
    }));

    it("Should get a long way by name with '\"'", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "lalala\"", false, false);

        mockBackend.expectOne(u => u.body.includes("lalala\\\"")).flush(response);
        // Assert
        const results = await promise;
        expect(results.features.length).toBe(0);
    }));

    it("Should get a place by id", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getPlaceGeometry("42");

        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);
        // Assert
        const results = await promise;
        expect(results.features.length).toBe(0);
    }));
});