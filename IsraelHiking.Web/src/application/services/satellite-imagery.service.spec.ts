import { describe, beforeEach, it, expect } from "vitest";
import { inject, TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting } from "@angular/common/http/testing";

import { SatelliteImageryService } from "./satellite-imagery.service";
import { Urls } from "../urls";

describe("SatelliteImageryService", () => {
    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                SatelliteImageryService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
    });

    it("Should get a tile from our own api and return its content", inject([SatelliteImageryService, HttpTestingController],
        async (service: SatelliteImageryService, mockBackend: HttpTestingController) => {
            const tile = new ArrayBuffer(4);

            const promise = service.getTile("satellite://12/34/56");
            mockBackend.expectOne(Urls.satelliteTilesApi + "12/34/56").flush(tile);
            const response = await promise;

            expect(response.data).toBe(tile);
        }));

    it("Should pass the cache headers of the response on so that the map can cache the tile", inject([SatelliteImageryService, HttpTestingController],
        async (service: SatelliteImageryService, mockBackend: HttpTestingController) => {
            const promise = service.getTile("satellite://1/2/3");
            mockBackend.expectOne(Urls.satelliteTilesApi + "1/2/3").flush(new ArrayBuffer(4), {
                headers: { "Cache-Control": "private, max-age=604800" }
            });
            const response = await promise;

            expect(response.cacheControl).toBe("private, max-age=604800");
        }));

    it("Should reject when the server refuses to serve the tile", inject([SatelliteImageryService, HttpTestingController],
        async (service: SatelliteImageryService, mockBackend: HttpTestingController) => {
            const promise = service.getTile("satellite://1/2/3");
            mockBackend.expectOne(Urls.satelliteTilesApi + "1/2/3").flush(null, { status: 403, statusText: "Forbidden" });

            await expect(promise).rejects.toBeDefined();
        }));
});
