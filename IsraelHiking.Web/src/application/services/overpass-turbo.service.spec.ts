import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";
import { OverpassTurboService } from "./overpass-turbo.service";

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
        expect(results).toBeNull();
    }));

    it("Should get a long mtb way by name", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "aaa", false, true);

        mockBackend.expectOne(u => u.body.includes("mtb:name")).flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeNull();
    }));

    it("Should get a long waterway way by name", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "aaa", true, false);

        mockBackend.expectOne(u => u.body.includes("waterway")).flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeNull();
    }));

    it("Should get a long way by name with '\"'", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getLongWay("id", "lalala\"", false, false);

        mockBackend.expectOne(u => u.body.includes("lalala\\\"")).flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeNull();
    }));

    it("Should get a place by id", inject([OverpassTurboService, HttpTestingController], async (service: OverpassTurboService, mockBackend: HttpTestingController) => {
        // Arrange
        const response = "<osm></osm>";
        // Act
        const promise = service.getPlaceGeometry("42");

        mockBackend.expectOne("https://overpass-api.de/api/interpreter").flush(response);
        // Assert
        const results = await promise;
        expect(results).toBeNull();
    }));
});