import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { LngLat } from "maplibre-gl";

import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { PmTilesService, TILES_ZOOM } from "./pmtiles.service";
import { SpatialHelper } from "./spatial.helper";
import { SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { Urls } from "../urls";
import type { ApplicationState, DownloadedArea, OfflineArea } from "../models";

/**
 * The areas that can be downloaded for offline usage and the ones that were. A downloaded area is kept on the
 * device in a file of its own next to its map files, since the areas the server offers can change after it was
 * downloaded and an area is updated by sending it as it was.
 */
@Service()
export class OfflineAreasService {
    /** What the name of the file an area is kept in ends with, after the id of the area */
    private static readonly AREA_FILE_SUFFIX = ".area.json";

    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly loggingService = inject(LoggingService);
    private readonly fileService = inject(FileService);
    private readonly store = inject(Store);

    /** The areas that can be downloaded, none when they can not be fetched, offline for example */
    public async getAreas(): Promise<OfflineArea[]> {
        try {
            const areas = await firstValueFrom(this.httpClient.get<GeoJSON.FeatureCollection>(Urls.offlineAreas));
            return areas.features as OfflineArea[];
        } catch (ex) {
            this.loggingService.warning(`[Offline Areas] Failed to get the areas: ${(ex as Error).message}`);
            return [];
        }
    }

    /** The name of an area in the language of the app, in English when it has none in it, none for a tile that was not named yet */
    public getName(area: Immutable<OfflineArea>): string | undefined {
        return area.properties[`name:${this.resources.getCurrentLanguageCodeSimplified()}`] ?? area.properties.name;
    }

    /**
     * The area at a point, the smallest of them where areas overlap, like Berlin in Brandenburg, since the larger
     * one has the rest of itself to be clicked on.
     */
    public findArea(areas: OfflineArea[], lngLat: LngLat): OfflineArea | null {
        return areas
            .filter(area => booleanPointInPolygon([lngLat.lng, lngLat.lat], area))
            .sort((a, b) => PmTilesService.getBoundsArea(a) - PmTilesService.getBoundsArea(b))[0] ?? null;
    }

    /**
     * Reads the areas that are kept on the device. A file that can not be read is skipped, which leaves its files
     * listed by the id of the area until they are downloaded again.
     */
    public async loadDownloadedAreas(): Promise<Record<string, OfflineArea>> {
        const areas: Record<string, OfflineArea> = {};
        for (const fileName of await this.fileService.listFileNamesInDataDirectory(OfflineAreasService.AREA_FILE_SUFFIX)) {
            try {
                const area = JSON.parse(await this.fileService.readFileInDataDirectory(fileName)) as OfflineArea;
                areas[area.properties.id] = area;
            } catch (ex) {
                this.loggingService.warning(`[Offline Areas] Failed to read ${fileName}: ${(ex as Error).message}`);
            }
        }
        return areas;
    }

    /**
     * Keeps an area in its file, and in the state when its files are already there - the files of an area that is
     * downloaded for the first time are read into the state along with it, see updateDownloadedAreasFromDevice.
     */
    public async saveDownloadedArea(area: Immutable<OfflineArea>): Promise<void> {
        await this.fileService.writeFileInDataDirectory(OfflineAreasService.getAreaFileName(area.properties.id), JSON.stringify(area));
        const downloadedAreas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        const downloadedArea = downloadedAreas[area.properties.id];
        if (downloadedArea != null) {
            this.store.dispatch(new SetDownloadedAreasAction({ ...downloadedAreas, [area.properties.id]: { ...downloadedArea, area } } as Record<string, DownloadedArea>));
        }
    }

    public async deleteDownloadedArea(id: string): Promise<void> {
        await this.fileService.deleteFileInDataDirectory(OfflineAreasService.getAreaFileName(id));
    }

    /** Names a downloaded area the way the user typed it, in every language, since that is the name they will look for */
    public renameDownloadedArea(area: Immutable<OfflineArea>, name: string): Promise<void> {
        return this.saveDownloadedArea(OfflineAreasService.withNames(area, { name }));
    }

    /** An area by other names, which keeps the id and the zooms its files hold */
    public static withNames(area: Immutable<OfflineArea>, names: Record<string, string>): Immutable<OfflineArea> {
        const { id, minZoom, maxZoom } = area.properties;
        return { ...area, properties: { ...names, id, minZoom, maxZoom } };
    }

    /** A tile as an area, whose id is the key of the tile, see PmTilesService, and whose files start at its zoom */
    public static createTileArea(tileX: number, tileY: number): OfflineArea {
        return OfflineAreasService.createSquareArea(PmTilesService.toTileKey(tileX, tileY), tileX, tileY, TILES_ZOOM, TILES_ZOOM);
    }

    /** Root files as an area, the whole world up to the zoom they hold, see PmTilesService.isRootKey */
    public static createRootArea(id: string, maxZoom: number): OfflineArea {
        return OfflineAreasService.createSquareArea(id, 0, 0, 0, 0, maxZoom);
    }

    private static createSquareArea(id: string, tileX: number, tileY: number, zoom: number, minZoom: number, maxZoom?: number): OfflineArea {
        const corners = [[tileX, tileY], [tileX + 1, tileY], [tileX + 1, tileY + 1], [tileX, tileY + 1], [tileX, tileY]]
            .map(([x, y]) => SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x, y }, zoom)));
        return { type: "Feature", properties: { id, minZoom, maxZoom }, geometry: { type: "Polygon", coordinates: [corners] } };
    }

    private static getAreaFileName(id: string): string {
        return id + OfflineAreasService.AREA_FILE_SUFFIX;
    }
}
