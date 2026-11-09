import { inject, Service } from "@angular/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Source, RangeResponse, PMTiles } from "pmtiles";
import { Store } from "@ngxs/store";
import { decode } from "base64-arraybuffer";
import { booleanIntersects } from "@turf/boolean-intersects";
import { bbox } from "@turf/bbox";

import { SpatialHelper } from "./spatial.helper";
import { LoggingService } from "./logging.service";
import type { ApplicationState, OfflineArea } from "../models";

export const TILES_ZOOM = 7;
/** The zoom up to which the root files hold the whole world, every downloaded area holds the zooms above it */
export const ROOT_ZOOM = 4;
/** The zoom the files of an area start at, see the server's OfflineFilesService */
export const AREA_MIN_ZOOM = ROOT_ZOOM + 1;

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

    /** How far inside its edges a tile is tested for overlapping an area, as a part of its size, see getFileNameByType */
    private static readonly TILE_INSET = 0.001;

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
     * The file a tile is in, the one of the downloaded area that the tile overlaps, see findDownloadedAreaId. An area
     * holds every tile its polygon touches, so a tile along its border is read from it even when its center is outside.
     * The tile is tested a little inside its edges, so that one that only touches an area, like the neighbour of a
     * tile that came before areas, is not read from it.
     */
    private getFileNameByType(z: number, x: number, y: number, type: string): string | null {
        const inset = PmTilesService.TILE_INSET;
        const corners = [[x + inset, y + inset], [x + 1 - inset, y + inset], [x + 1 - inset, y + 1 - inset], [x + inset, y + 1 - inset], [x + inset, y + inset]]
            .map(([cornerX, cornerY]) => SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x: cornerX, y: cornerY }, z)));
        const areaId = this.findDownloadedAreaId({ type: "Polygon", coordinates: [corners] }, z);
        return areaId == null ? null : `${type}+${areaId}.pmtiles`;
    }

    /**
     * The downloaded area whose files hold a point or a tile at a zoom, the smallest of them where they overlap, so that
     * an area is read before the root files of the whole world, which only fill in where there is no area.
     */
    public findDownloadedAreaId(geometry: GeoJSON.Point | GeoJSON.Polygon, zoom: number): string | null {
        const downloadedAreas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        const areas = Object.values(downloadedAreas)
            .map(({ area }) => area as OfflineArea)
            .filter(area => area != null && (area.properties.minZoom ?? 0) <= zoom && zoom <= (area.properties.maxZoom ?? Infinity) &&
                booleanIntersects(geometry, area))
            .sort((a, b) => PmTilesService.getBoundsArea(a) - PmTilesService.getBoundsArea(b));
        return areas[0]?.properties.id ?? null;
    }

    /** How large an area is, by its bounds, which is enough to tell a smaller area from a larger one */
    public static getBoundsArea(area: OfflineArea): number {
        const [minLng, minLat, maxLng, maxLat] = bbox(area);
        return (maxLng - minLng) * (maxLat - minLat);
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

    /** The key of the root files, which hold the whole world up to ROOT_ZOOM and come with every area */
    public static readonly ROOT_KEY = "root";

    /** The key of the zoom 6 root files, which are only kept as long as a tile that came before areas is */
    public static readonly LEGACY_ROOT_KEY = "legacy-root";

    /** Whether a key is of root files, which are of no area the user downloaded and are not listed */
    public static isRootKey(key: string): boolean {
        return key === PmTilesService.ROOT_KEY || key === PmTilesService.LEGACY_ROOT_KEY;
    }

    /** The key the files of a tile that was downloaded before areas are stored under */
    public static toTileKey(tileX: number, tileY: number): string {
        return `${tileX}-${tileY}`;
    }

    /**
     * The tile a key was made of, null for the root keys and for the id of an area, which are not of a tile.
     */
    public static fromTileKey(tileKey: string): { tileX: number, tileY: number } | null {
        const match = tileKey.match(/^(\d+)-(\d+)$/);
        return match == null ? null : { tileX: +match[1], tileY: +match[2] };
    }
}