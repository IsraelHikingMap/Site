/**
 * An area that can be downloaded for offline usage, as the server offers it and as it is kept on the device
 * along with its files. "name" is its English name and "name:xx" its name in another language of the app, an
 * old tile has neither until the user names it. The id of an old tile is made of its x and y, see OfflineAreasService.toTileId.
 * The zooms are the ones its files hold, which only an area that is kept on the device has, see OfflineAreasService.findDownloadedAreaId.
 */
export type OfflineArea = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, OfflineAreaProperties>;

type OfflineAreaProperties = {
    id: string;
    minZoom?: number;
    maxZoom?: number;
} & Partial<Record<`name${string}`, string>>;

/** A map file of a downloaded area, with the date it was downloaded at and the version of the data it holds, when it has one */
export type FileNameDateVersion = {
    fileName: string;
    date: string;
    version?: string;
};

/**
 * What the device holds of an area, of an old tile or of the root files, see
 * OfflineAreasService.isRootId, keyed by its id. It is there as long as any of its map files are.
 */
export type DownloadedArea = {
    /** The area as it is kept on the device, null for an area whose file could not be read */
    area: OfflineArea | null;
    files: FileNameDateVersion[];
    hasRoutingTiles: boolean;
};
