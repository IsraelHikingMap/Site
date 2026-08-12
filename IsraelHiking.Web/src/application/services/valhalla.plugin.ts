import { InjectionToken } from "@angular/core";
import { registerPlugin } from "@capacitor/core";

/**
 * The native offline routing plugin, see android/.../com/mapeak/valhalla/ValhallaPlugin.kt.
 * This file is the boundary of that plugin - when it is extracted to its own capacitor plugin
 * this is the only file that should be replaced by an import from it.
 */
export interface ValhallaPlugin {
    /**
     * Extracts a downloaded slice of routing tiles, the tar is deleted once extracted.
     * Adjacent slices are extracted into the same directory so that routing can cross between them,
     * the sliceId is what allows a single slice to be removed later on.
     */
    extractTiles(options: { tarFileName: string; sliceId: string }): Promise<{ extractedFiles: number; tilesDir: string }>;
    /**
     * Removes the tiles of a single slice, tiles that its neighbours share with it are kept.
     */
    deleteTiles(options: { sliceId: string }): Promise<void>;
    /**
     * Whether there are any tiles on the device, i.e. whether offline routing can be attempted.
     */
    hasTiles(): Promise<{ hasTiles: boolean }>;
    /**
     * Removes all the tiles from the device.
     */
    clearTiles(): Promise<void>;
    /**
     * Calculates a route, returns the raw valhalla response json.
     * costingOptions is a valhalla costing_options object, keyed by costing name.
     * An elevationInterval of 0 means no elevation is requested.
     */
    route(options: {
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        costing: string;
        costingOptions?: Record<string, unknown>;
        elevationInterval: number;
    }): Promise<{ raw: string }>;
}

/**
 * Injected rather than used directly so that it can be replaced in tests, and so that swapping the
 * implementation for a real capacitor plugin later is a change of this factory alone.
 */
export const VALHALLA_PLUGIN = new InjectionToken<ValhallaPlugin>("VALHALLA_PLUGIN", {
    providedIn: "root",
    factory: () => registerPlugin<ValhallaPlugin>("Valhalla")
});

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
