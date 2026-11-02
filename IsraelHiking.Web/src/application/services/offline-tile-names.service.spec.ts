import { describe, beforeEach, it, expect, vi } from "vitest";
import { TestBed } from "@angular/core/testing";
import { provideHttpClient, withInterceptorsFromDi } from "@angular/common/http";
import { HttpTestingController, provideHttpClientTesting, type TestRequest } from "@angular/common/http/testing";
import { provideStore, Store } from "@ngxs/store";

import { OfflineTileNamesService } from "./offline-tile-names.service";
import { OfflineAreasService } from "./offline-areas.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { InMemoryReducer, SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OfflineArea } from "../models";

describe("OfflineTileNamesService", () => {
    let service: OfflineTileNamesService;
    let mockBackend: HttpTestingController;
    let store: Store;
    let fileService: FileService;
    const tile = OfflineAreasService.createTileArea(76, 52);

    beforeEach(() => {
        TestBed.configureTestingModule({
            providers: [
                provideStore([InMemoryReducer]),
                { provide: ResourcesService, useValue: { getCurrentLanguageCodeSimplified: () => "en" } },
                { provide: LoggingService, useValue: { warning: () => { } } },
                { provide: FileService, useValue: { writeFileInDataDirectory: vi.fn(() => Promise.resolve()) } },
                OfflineAreasService,
                OfflineTileNamesService,
                provideHttpClient(withInterceptorsFromDi()),
                provideHttpClientTesting()
            ]
        });
        service = TestBed.inject(OfflineTileNamesService);
        mockBackend = TestBed.inject(HttpTestingController);
        store = TestBed.inject(Store);
        fileService = TestBed.inject(FileService);
        store.dispatch(new SetDownloadedAreasAction({ [tile.properties.id]: tile }));
    });

    it("should ask the server for the names of the tile and keep them with the tile", async () => {
        const promise = service.nameTile(tile);
        const request = await expectNameRequest();
        request.flush({ name: "Israel", "name:he": "ישראל" });
        await promise;

        expect(request.request.params.get("tileX")).toBe("76");
        expect(request.request.params.get("tileY")).toBe("52");
        expect(getTile().properties).toEqual({ id: "76-52", name: "Israel", "name:he": "ישראל" });
        expect(fileService.writeFileInDataDirectory).toHaveBeenCalledWith("76-52.area.json", JSON.stringify(getTile()));
    });

    it("should number in every language the names another area already goes by", async () => {
        const otherTile = OfflineAreasService.createTileArea(75, 52);
        store.dispatch(new SetDownloadedAreasAction({
            [tile.properties.id]: tile,
            [otherTile.properties.id]: { ...otherTile, properties: { id: otherTile.properties.id, name: "Israel" } }
        }));

        const promise = service.nameTile(tile);
        (await expectNameRequest()).flush({ name: "Israel", "name:he": "ישראל" });
        await promise;

        expect(getTile().properties).toEqual({ id: "76-52", name: "Israel (2)", "name:he": "ישראל (2)" });
    });

    it("should leave a tile without a name when its names can not be fetched", async () => {
        const promise = service.nameTile(tile);
        (await expectNameRequest()).flush("Not implemented", { status: 501, statusText: "Not Implemented" });
        await promise;

        expect(getTile().properties.name).toBeUndefined();
        expect(fileService.writeFileInDataDirectory).not.toHaveBeenCalled();
    });

    it("should not look up a tile that already has a name", async () => {
        await service.nameTile({ ...tile, properties: { id: tile.properties.id, name: "My tile" } });

        mockBackend.expectNone(r => r.url === Urls.offlineTileName);
    });

    it("should not look up an area that is not a tile", async () => {
        await service.nameTile({ ...tile, properties: { id: "israel-and-palestine" } });

        mockBackend.expectNone(r => r.url === Urls.offlineTileName);
    });

    async function expectNameRequest(): Promise<TestRequest> {
        await new Promise(resolve => setTimeout(resolve));
        return mockBackend.expectOne(r => r.url === Urls.offlineTileName);
    }

    function getTile(): OfflineArea {
        return store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas)[tile.properties.id] as OfflineArea;
    }
});
