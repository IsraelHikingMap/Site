import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";
import type { LngLat } from "maplibre-gl";

import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { SpatialHelper } from "./spatial.helper";
import { SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { Urls } from "../urls";
import type { ApplicationState, DownloadedArea, OfflineArea } from "../models";

/** The zooms the files of an area hold, see findDownloadedAreaIdOfTile */
export type AreaZooms = { minZoom?: number, maxZoom?: number };


/**
 * The areas that can be downloaded for offline usage and the ones that were. A downloaded area is kept on the
 * device in a file of its own next to its map files, since the areas the server offers can change after it was
 * downloaded and an area is updated by sending it as it was.
 */
@Service()
export class OfflineAreasService {
    /** What the name of the file an area is kept in ends with, after the id of the area */
    private static readonly AREA_FILE_SUFFIX = ".area.json";

    /** How far inside its edges a tile is tested for overlapping an area, as a part of its size, see findDownloadedAreaIdOfTile */
    private static readonly TILE_INSET = 0.001;

    /** The id of the root files, which hold the whole world at the zooms below the areas and come with every area */
    public static readonly ROOT_ID = "root";

    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly loggingService = inject(LoggingService);
    private readonly fileService = inject(FileService);
    private readonly store = inject(Store);

    /** The areas that can be downloaded, none when they can not be fetched, offline for example */
    public async getAreas(): Promise<OfflineArea[]> {
        try {
            const areas = await firstValueFrom(this.httpClient.get<{ features: OfflineArea[] }>(Urls.offlineAreas));
            return areas.features;
        } catch (ex) {
            this.loggingService.warning(`[Offline Areas] Failed to get the areas: ${(ex as Error).message}`);
            return [];
        }
    }

    /** The name of an area in the language of the app, in English when it has none in it, none for an old tile the user did not name */
    public getName(area: Immutable<OfflineArea>): string | undefined {
        return area.properties[`name:${this.resources.getCurrentLanguageCodeSimplified()}`] ?? area.properties.name;
    }

    /**
     * The area at a point, the smallest of them where areas overlap, like Berlin in Brandenburg, since the larger
     * one has the rest of itself to be clicked on.
     */
    public findArea(areas: OfflineArea[], lngLat: LngLat): OfflineArea | null {
        return areas
            .filter(area => SpatialHelper.isPointInPolygon([lngLat.lng, lngLat.lat], area))
            .sort((a, b) => SpatialHelper.getBoundsArea(a) - SpatialHelper.getBoundsArea(b))[0] ?? null;
    }

    /**
     * The downloaded area whose files hold a tile, the smallest of them where they overlap, so that an area is read before the
     * root files of the whole world, which only fill in where there is no area. An area holds every tile its polygon touches,
     * so the tile is tested a little inside its edges, so that one that only touches an area, like the neighbour of an old
     * tile, is not read from it.
     */
    public static findDownloadedAreaIdOfTile(downloadedAreas: Immutable<Record<string, DownloadedArea>>, z: number, x: number, y: number): string | null {
        const tileWithInsets = SpatialHelper.getTilePolygon({ x, y }, z, OfflineAreasService.TILE_INSET);
        const areas = Object.values(downloadedAreas)
            .map(({ area }) => area)
            .filter(area => area != null && (area.properties.minZoom ?? 0) <= z && z <= (area.properties.maxZoom ?? Infinity) &&
                SpatialHelper.intersects(tileWithInsets, area))
            .sort((a, b) => SpatialHelper.getBoundsArea(a) - SpatialHelper.getBoundsArea(b));
        return areas[0]?.properties.id ?? null;
    }

    /** Whether an id is of the root files, which are of no area the user downloaded and are not listed */
    public static isRootId(id: string): boolean {
        return id === OfflineAreasService.ROOT_ID;
    }

    /** Whether an id is of an old tile, which is its x and y, "x-y" */
    public static isTileId(id: string): boolean {
        return /^\d+-\d+$/.test(id);
    }

    /**
     * Reads the metadata of the areas that are kept on the device. A file that can not be read is skipped, which leaves its files
     * listed by the id of the area until they are downloaded again.
     */
    public async loadAreasMetadata(): Promise<Record<string, OfflineArea>> {
        const areas: Record<string, OfflineArea> = {};
        for (const fileName of await this.fileService.listFileNamesInDataDirectory(OfflineAreasService.AREA_FILE_SUFFIX)) {
            try {
                const area: OfflineArea = JSON.parse(await this.fileService.readFileInDataDirectory(fileName));
                areas[area.properties.id] = area;
            } catch (ex) {
                this.loggingService.warning(`[Offline Areas] Failed to read ${fileName}: ${(ex as Error).message}`);
            }
        }
        return areas;
    }

    /**
     * Writes the metadata of an area to its file, with the zooms its files hold, and to the state when its files are already
     * there - the files of an area that is downloaded for the first time are read into the state along with it, see
     * updateDownloadedAreasFromDevice.
     */
    public async saveAreaMetadata(areaToSave: Immutable<OfflineArea>, zooms: AreaZooms): Promise<void> {
        const area = { ...areaToSave, properties: { ...areaToSave.properties, ...zooms } };
        await this.fileService.writeFileInDataDirectory(OfflineAreasService.getAreaFileName(area.properties.id), JSON.stringify(area));
        const downloadedAreas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        const downloadedArea = downloadedAreas[area.properties.id];
        if (downloadedArea != null) {
            this.store.dispatch(new SetDownloadedAreasAction({ ...downloadedAreas, [area.properties.id]: { ...downloadedArea, area } } as Record<string, DownloadedArea>));
        }
    }

    public async deleteAreaMetadata(id: string): Promise<void> {
        await this.fileService.deleteFileInDataDirectory(OfflineAreasService.getAreaFileName(id));
    }

    /** Names a downloaded area the way the user typed it, in every language, since that is the name they will look for */
    public renameDownloadedArea(area: Immutable<OfflineArea>, name: string): Promise<void> {
        const { id, minZoom, maxZoom } = area.properties;
        return this.saveAreaMetadata({ ...area, properties: { id, name } }, { minZoom, maxZoom });
    }

    /** The root files as an area, the whole world */
    public static createRootArea(zooms: AreaZooms = {}): OfflineArea {
        return { type: "Feature", properties: { id: OfflineAreasService.ROOT_ID, ...zooms }, geometry: SpatialHelper.getTilePolygon({ x: 0, y: 0 }, 0) };
    }

    private static getAreaFileName(id: string): string {
        return id + OfflineAreasService.AREA_FILE_SUFFIX;
    }
}
