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

/** The zoom of the old tiles, whose ids are their x and y at it, see toTileId */
export const TILES_ZOOM = 7;

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
     * The downloaded area whose files hold a tile, see findDownloadedAreaId. An area holds every tile its polygon touches,
     * so a tile along its border is read from it even when its center is outside. The tile is tested a little inside its
     * edges, so that one that only touches an area, like the neighbour of an old tile, is not read from it.
     */
    public static findDownloadedAreaIdOfTile(downloadedAreas: Immutable<Record<string, DownloadedArea>>, z: number, x: number, y: number): string | null {
        return OfflineAreasService.findDownloadedAreaId(downloadedAreas, SpatialHelper.getTilePolygon({ x, y }, z, OfflineAreasService.TILE_INSET), z);
    }

    /**
     * The downloaded area whose files hold a point or a tile at a zoom, the smallest of them where they overlap, so that
     * an area is read before the root files of the whole world, which only fill in where there is no area.
     */
    public static findDownloadedAreaId(downloadedAreas: Immutable<Record<string, DownloadedArea>>, geometry: GeoJSON.Point | GeoJSON.Polygon,
        zoom: number): string | null {
        const areas = Object.values(downloadedAreas)
            .map(({ area }) => area)
            .filter(area => area != null && (area.properties.minZoom ?? 0) <= zoom && zoom <= (area.properties.maxZoom ?? Infinity) &&
                SpatialHelper.intersects(geometry, area))
            .sort((a, b) => SpatialHelper.getBoundsArea(a) - SpatialHelper.getBoundsArea(b));
        return areas[0]?.properties.id ?? null;
    }

    /** Whether an id is of the root files, which are of no area the user downloaded and are not listed */
    public static isRootId(id: string): boolean {
        return id === OfflineAreasService.ROOT_ID;
    }

    /** The id the files of an old tile are kept under */
    public static toTileId(tileX: number, tileY: number): string {
        return `${tileX}-${tileY}`;
    }

    /**
     * The tile an id was made of, null for the root id and for the id of an area, which are not of a tile.
     */
    public static fromTileId(tileId: string): { tileX: number, tileY: number } | null {
        const match = tileId.match(/^(\d+)-(\d+)$/);
        return match == null ? null : { tileX: +match[1], tileY: +match[2] };
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
     * Writes the metadata of an area to its file, and to the state when its files are already there - the files of an area that is
     * downloaded for the first time are read into the state along with it, see updateDownloadedAreasFromDevice.
     */
    public async saveAreaMetadata(area: Immutable<OfflineArea>): Promise<void> {
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
        return this.saveAreaMetadata(OfflineAreasService.withNames(area, { name }));
    }

    /** An area by other names, which keeps the id and the zooms its files hold */
    public static withNames(area: Immutable<OfflineArea>, names: Record<string, string>): Immutable<OfflineArea> {
        const { id, minZoom, maxZoom } = area.properties;
        return { ...area, properties: { ...names, id, minZoom, maxZoom } };
    }

    /** An area that holds the given zooms, which are the ones its files hold, see findDownloadedAreaId */
    public static withZooms<T extends Immutable<OfflineArea>>(area: T, zooms: { minZoom: number, maxZoom: number }): T {
        return { ...area, properties: { ...area.properties, minZoom: zooms.minZoom, maxZoom: zooms.maxZoom } };
    }

    /** A tile as an area, see toTileId */
    public static createTileArea(tileX: number, tileY: number): OfflineArea {
        return OfflineAreasService.createSquareArea(OfflineAreasService.toTileId(tileX, tileY), tileX, tileY, TILES_ZOOM);
    }

    /** The root files as an area, the whole world */
    public static createRootArea(): OfflineArea {
        return OfflineAreasService.createSquareArea(OfflineAreasService.ROOT_ID, 0, 0, 0);
    }

    private static createSquareArea(id: string, tileX: number, tileY: number, zoom: number): OfflineArea {
        return { type: "Feature", properties: { id }, geometry: SpatialHelper.getTilePolygon({ x: tileX, y: tileY }, zoom) };
    }

    private static getAreaFileName(id: string): string {
        return id + OfflineAreasService.AREA_FILE_SUFFIX;
    }
}
