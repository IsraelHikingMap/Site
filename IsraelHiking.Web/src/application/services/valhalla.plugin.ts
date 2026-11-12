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
     * Every file is extracted into the same directory so that routing can cross between them, and the
     * tiles it held are kept under the given id, which is what removes them later on - the plugin gives
     * the id no meaning of its own, the app uses the id of the area the file was downloaded for.
     */
    extractFile(options: { tarFileName: string; id: string }): Promise<{ extractedFiles: number; tilesDir: string }>;
    /**
     * Removes the routing tiles kept under an id, the ones that are also kept under another id stay.
     */
    deleteById(options: { id: string }): Promise<void>;
    /**
     * The ids routing tiles are kept under. The plugin is the one that keeps them, so this is what the
     * app reads them from.
     */
    listIds(): Promise<{ ids: string[] }>;
    /**
     * Removes the routing tiles kept under every id.
     */
    deleteAll(): Promise<void>;
    /**
     * Stores the routing profiles, as they were downloaded, so that a route uses the same costing
     * options the server would have used.
     */
    storeProfiles(options: { profiles: string }): Promise<void>;
    /**
     * Calculates a route, returns the raw valhalla response json.
     * The costing model and its options are taken from the profile of the given name, out of the
     * routing files that were downloaded with the offline maps - without them, as without tiles,
     * there is no offline routing.
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
