import { inject, Service } from "@angular/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Source, RangeResponse, PMTiles } from "pmtiles";
import { Store } from "@ngxs/store";
import { decode } from "base64-arraybuffer";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { Immutable } from "immer";

import { SpatialHelper } from "./spatial.helper";
import { LoggingService } from "./logging.service";
import type { ApplicationState, OfflineArea } from "../models";

export const TILES_ZOOM = 7;

class CapacitorSource implements Source {

    constructor(private readonly path: string) { }

    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        const content = await Filesystem.readFile({
            path: this.path,
            directory: Directory.Data,
            offset: offset,
            length: length
        });
        const data = decode(content.data as string);
        return { data };
    }

    getKey() { return this.path }
}

@Service()
export class PmTilesService {

    private readonly sourcesCache = new Map<string, CapacitorSource>;

    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    /**
     * Creates a source for the given file, throws when the file does not exist.
     * Only existing files are cached, so a file that was downloaded later will be picked up.
     */
    private async getSource(filePath: string): Promise<Source> {
        if (this.sourcesCache.has(filePath)) {
            return this.sourcesCache.get(filePath);
        }
        await Filesystem.stat({ path: filePath, directory: Directory.Data });
        const source = new CapacitorSource(filePath);
        this.sourcesCache.set(filePath, source);
        return source;
    }

    /**
     * Removes a file from the sources cache, should be called when a file is deleted.
     */
    public invalidateFile(fileName: string): void {
        this.sourcesCache.delete(fileName);
    }

    /**
     * Get's a tile from the stored pmtiles file
     * @param url - should be something like custom://filename-without-pmtiles-extention/{z}/{x}/{y}.png
     * @returns 
     */
    public async getTileByUrl(url: string): Promise<ArrayBuffer> {
        const splitUrl = url.split("/");
        const fileName = splitUrl[2] + ".pmtiles";
        const z = +splitUrl[splitUrl.length - 3];
        const x = +splitUrl[splitUrl.length - 2];
        const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);
        return await this.getTileFromFile(fileName, z, x, y);
    }

    public async getTileByType(z: number, x: number, y: number, type: string): Promise<ArrayBuffer> {
        const fileName = this.getFileNameByType(z, x, y, type);
        if (fileName == null) {
            return new ArrayBuffer(0);
        }
        return await this.getTileFromFile(fileName, z, x, y);
    }

    /**
     * The file a tile is in: the root file below the zoom of the downloaded tiles, then the file of the downloaded
     * tile it is a part of, and then the file of a downloaded area its middle is in. Null when none of them has it.
     */
    private getFileNameByType(z: number, x: number, y: number, type: string): string | null {
        if (z < TILES_ZOOM) {
            const downloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState.downloadedTiles);
            return downloadedTiles[PmTilesService.toTileKey()] == null ? null : `${type}-${TILES_ZOOM - 1}.pmtiles`;
        }
        const { tileX, tileY } = SpatialHelper.getParentZoomTileCoordinates({ x, y }, z, TILES_ZOOM);
        const tileKey = PmTilesService.toTileKey(tileX, tileY);
        const downloadedTiles = this.store.selectSnapshot((state: ApplicationState) => state.inMemoryState.downloadedTiles);
        if (downloadedTiles[tileKey] != null) {
            return `${type}+${tileKey}.pmtiles`;
        }
        const center = SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: x + 0.5, y: y + 0.5 }, z));
        const areaId = this.findDownloadedAreaId(center);
        return areaId == null ? null : `${type}+${areaId}.pmtiles`;
    }

    /**
     * The downloaded area a point is in, that is not a tile, since the files of a tile are found by the tile itself.
     * Where downloaded areas overlap, any of them has the point, since an area reaches a few kilometers past its border.
     */
    public findDownloadedAreaId(point: GeoJSON.Position): string | null {
        const state = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState);
        const area = Object.values(state.downloadedAreas).find(downloadedArea =>
            PmTilesService.fromTileKey(downloadedArea.properties.id) == null &&
            state.downloadedTiles[downloadedArea.properties.id] != null &&
            booleanPointInPolygon(point, downloadedArea as Immutable<OfflineArea> as OfflineArea));
        return area?.properties.id ?? null;
    }

    /**
     * A pmtiles file is sparse - tiles without any data are simply not stored in it,
     * so a missing tile is returned as an empty tile and not as an error.
     */
    private async getTileFromFile(fileName: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
        const source = await this.getSource(fileName);
        const pmTilesProvider = new PMTiles(source);
        const response = await pmTilesProvider.getZxy(z, x, y);
        return response?.data ?? new ArrayBuffer(0);
    }

    public async isOfflineFileAvailable(z: number, x: number, y: number, type: string): Promise<boolean> {
        if (this.store.selectSnapshot((state: ApplicationState) => state.offlineState).isSubscribed === false) {
            return false;
        }
        const fileName = this.getFileNameByType(z, x, y, type);
        if (fileName == null) {
            return false;
        }
        try {
            await this.getSource(fileName);
        } catch (ex) {
            this.loggingService.warning(`Failed to open file ${fileName} for type ${type} and ${z}/${x}/${y}: ${(ex as Error).message}`);
            return false;
        }
        return true;
    }

    public async getVersion(fileName: string): Promise<string> {
        const source = await this.getSource(fileName);
        const pmTilesProvider = new PMTiles(source);
        return (await pmTilesProvider.getMetadata() as { version?: string })?.version;
    }

    /**
     * The key the files of a tile are stored under, where an undefined tile is the root, non-tiled, one.
     */
    public static toTileKey(tileX?: number, tileY?: number): string {
        return `${tileX}-${tileY}`;
    }

    /**
     * The tile a key was made of, null for the root key and for the id of an area, which are not of a tile.
     */
    public static fromTileKey(tileKey: string): { tileX: number, tileY: number } | null {
        const match = tileKey.match(/^(\d+)-(\d+)$/);
        return match == null ? null : { tileX: +match[1], tileY: +match[2] };
    }
}