import type { FileNameDateVersion } from "./state/offline-state";

/**
 * An area that can be downloaded for offline usage, as the server offers it and as it is kept on the device
 * along with its files. "name" is its English name and "name:xx" its name in another language of the app, a
 * tile has neither until the server names it. The id of a tile is the key of the tile, see PmTilesService.
 * The zooms are the ones its files hold, which only an area that is kept on the device has, see PmTilesService.findDownloadedAreaId.
 */
export type OfflineArea = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, OfflineAreaProperties>;

type OfflineAreaProperties = {
    id: string;
    minZoom?: number;
    maxZoom?: number;
} & Partial<Record<`name${string}`, string>>;

/**
 * What the device holds of an area, of a tile that was downloaded before areas existed or of the root files, see
 * PmTilesService.isRootKey, keyed by its id. It is there as long as any of its map files are.
 */
export type DownloadedArea = {
    /** The area as it is kept on the device, null for an area whose file could not be read */
    area: OfflineArea | null;
    files: FileNameDateVersion[];
    hasRoutingTiles: boolean;
};
