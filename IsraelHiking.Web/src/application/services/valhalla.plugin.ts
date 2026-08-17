import { registerPlugin } from "@capacitor/core";

/**
 * The valhalla response, the error fields are set instead of the trip when the request fails,
 * for example: { code: 125, message: "No costing method found" }.
 */
export type ValhallaRouteResponse = {
    code?: number;
    message?: string;
    trip?: {
        units?: string;
        summary?: { length?: number; time?: number };
        legs?: ValhallaRouteLeg[];
    };
};

export type ValhallaRouteLeg = {
    /** An encoded polyline with 6 digits of precision */
    shape?: string;
    /** Sampled every elevation_interval meters along the leg */
    elevation?: number[];
};

/**
 * The native offline routing plugin, see android/.../com/mapeak/valhalla/ValhallaPlugin.kt.
 * This file is the boundary of that plugin - when it is extracted to its own capacitor plugin
 * this is the only file that should be replaced by an import from it.
 */
export interface ValhallaPlugin {
    /**
     * Extracts a downloaded file of routing tiles, the tar is deleted once extracted.
     * The files of adjacent tiles are extracted into the same directory so that routing can cross
     * between them, the tileKey is what allows the tiles of one of them to be removed later on.
     */
    extractFile(options: { tarFileName: string; tileKey: string }): Promise<{ extractedFiles: number; tilesDir: string }>;
    /**
     * Removes the routing tiles of a single tile, the ones its neighbours share with it are kept.
     */
    deleteTile(options: { tileKey: string }): Promise<void>;
    /**
     * The keys of the tiles whose routing tiles are on the device, i.e. the areas that can be routed
     * in. The plugin is the one that keeps them, so this is what the app reads them from.
     */
    listTiles(): Promise<{ tileKeys: string[] }>;
    /**
     * Removes all the tiles from the device.
     */
    clearTiles(): Promise<void>;
    /**
     * Stores the routing profiles next to the tiles, so that a route uses the same costing options
     * the server would have used. The content is the profiles file as it is served.
     */
    storeProfiles(options: { profiles: string }): Promise<void>;
    /**
     * Calculates a route, returns the raw valhalla response json.
     * The costing model and its options are taken from the stored profile of the given name, so
     * without the profiles there is no offline routing, the same as without tiles.
     * An elevationInterval of 0 means no elevation is requested.
     */
    route(options: {
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        profile: string;
        elevationInterval: number;
    }): Promise<{ raw: string }>;
}

export const Valhalla = registerPlugin<ValhallaPlugin>("Valhalla");
