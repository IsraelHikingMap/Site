/**
 * An area that can be downloaded for offline usage, as the server offers it and as it is kept on the device
 * along with its files. "name" is its English name and "name:xx" its name in another language of the app, a
 * tile has neither until the server names it. The id of a tile is the key of the tile, see PmTilesService.
 */
export type OfflineArea = GeoJSON.Feature<GeoJSON.Polygon | GeoJSON.MultiPolygon, { id: string } & Partial<Record<string, string>>>;
