import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import { registerPlugin } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import polyline from "@mapbox/polyline";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { FileService } from "./file.service";
import { ElevationProvider } from "./elevation.provider";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAltTime, RoutingType } from "../models";

// POC: native Valhalla routing lives on the existing Car plugin
// (android/.../car/ReactivePreferencesPlugin.kt, registered as "ReactivePreferences").
interface CarPlugin {
    route(options: {
        tilesDir: string;
        fromLat: number;
        fromLng: number;
        toLat: number;
        toLng: number;
        costing: string;
        elevationInterval: number;
    }): Promise<{ raw: string }>;
    extractTiles(options: { tarFileName: string; tilesDir: string }): Promise<{ extractedFiles: number; tilesDir: string }>;
}

type ValhallaRouteResponse = {
    // present on error responses (e.g. { code: 125, message: "No costing method found" })
    code?: number;
    message?: string;
    trip?: {
        units?: string;
        summary?: { length?: number; time?: number };
        // elevation is sampled every elevation_interval meters along the leg
        legs?: { shape?: string; elevation?: number[] }[];
    };
};

// The app's RoutingType is not a Valhalla costing model - map it.
const VALHALLA_COSTING: Record<string, string> = {
    Hike: "pedestrian",
    Bike: "bicycle",
    "4WD": "auto"
};

const CarPlugin = registerPlugin<CarPlugin>("ReactivePreferences");
// Shared tile directory: each area's extract is untarred into here (Option B).
const VALHALLA_TILES_DIR = "valhalla_tiles";
const VALHALLA_DEFAULT_AREA = "israel";
const VALHALLA_ELEVATION_INTERVAL_METERS = 30;

@Injectable()
export class RoutingProvider {
    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly elevationProvider = inject(ElevationProvider);
    private readonly fileService = inject(FileService);
    private readonly store = inject(Store);

    public async getRoute(latlngStart: LatLngAltTime, latlngEnd: LatLngAltTime, routinType: RoutingType): Promise<LatLngAltTime[]> {
        if (routinType === "None") {
            const distance = SpatialService.getDistanceInMeters(latlngStart, latlngEnd);
            const pointsCount = Math.min(100, Math.ceil(distance / 100));
            const latlngs = [];
            for (let i = 0; i <= pointsCount; i++) {
                const lat = latlngStart.lat + (latlngEnd.lat - latlngStart.lat) * (i / pointsCount);
                const lng = latlngStart.lng + (latlngEnd.lng - latlngStart.lng) * (i / pointsCount);
                latlngs.push({ lat, lng });
            }
            await this.elevationProvider.updateHeights(latlngs);
            return latlngs;
        }
        const address = Urls.routing + "?from=" + latlngStart.lat + "," + latlngStart.lng +
            "&to=" + latlngEnd.lat + "," + latlngEnd.lng + "&type=" + routinType;
        try {
            const data = await firstValueFrom(this.httpClient.get<GeoJSON.FeatureCollection<GeoJSON.LineString>>(address).pipe(timeout(100)));
            return data.features[0].geometry.coordinates.map(c => SpatialService.toLatLng(c));
        } catch (ex) {
            try {
                return await this.getOffineRoute(latlngStart, latlngEnd, routinType);
            } catch (ex2) {
                this.loggingService.error(`[Routing] failed: ${(ex as Error).message}, ${(ex2 as Error).message}`);
                const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
                this.toastService.warning(offlineState.isSubscribed || !this.runningContextService.isCapacitor
                    ? this.resources.routingFailedTryShorterRoute
                    : this.resources.routingFailedBuySubscription
                );
                const lngLat = [latlngStart, latlngEnd];
                this.elevationProvider.updateHeights(lngLat);
                return lngLat;
            }
        }
    }

    /**
     * POC: get a route from point A to B using the native Valhalla engine and a
     * prebuilt tile tar downloaded to the device. Returns the same shape as
     * getRoute (with elevation added via the existing provider). Android only.
     */
    public async getOffineRoute(latlngStart: LatLngAltTime, latlngEnd: LatLngAltTime, costing = "auto"): Promise<LatLngAltTime[]> {
        await this.ensureValhallaArea(VALHALLA_DEFAULT_AREA, "https://mapeak.com/.well-known/valhalla_tiles_IL.tar");
        const result = await CarPlugin.route({
            tilesDir: VALHALLA_TILES_DIR,
            fromLat: latlngStart.lat,
            fromLng: latlngStart.lng,
            toLat: latlngEnd.lat,
            toLng: latlngEnd.lng,
            costing: VALHALLA_COSTING[costing] ?? costing,
            elevationInterval: VALHALLA_ELEVATION_INTERVAL_METERS
        });
        const response = JSON.parse(result.raw) as ValhallaRouteResponse;
        if (response.trip == null) {
            throw new Error(`Valhalla error ${response.code}: ${response.message}`);
        }
        const trip = response.trip;
        const latlngs = (trip.legs ?? []).flatMap(leg => this.valhallaLegToLatLngs(leg));
        this.loggingService.info(`[Routing][Valhalla] got ${latlngs.length} points, ` +
            `length ${trip?.summary?.length} ${trip?.units}, time ${trip?.summary?.time}s`);
        return latlngs;
    }

    /**
     * Decodes a Valhalla leg's shape (npm @mapbox/polyline, precision 1e6) and
     * assigns the leg's Valhalla elevation samples (one per elevation_interval
     * meters) to each point by interpolating along the cumulative distance.
     */
    private valhallaLegToLatLngs(leg: { shape?: string; elevation?: number[] }): LatLngAltTime[] {
        const points: LatLngAltTime[] = polyline.decode(leg.shape ?? "", 6).map(([lat, lng]) => ({ lat, lng }));
        const elevations = leg.elevation ?? [];
        if (elevations.length === 0) {
            return points;
        }
        let cumulative = 0;
        for (let i = 0; i < points.length; i++) {
            if (i > 0) {
                cumulative += SpatialService.getDistanceInMeters(points[i - 1], points[i]);
            }
            const sample = cumulative / VALHALLA_ELEVATION_INTERVAL_METERS;
            const low = Math.min(Math.floor(sample), elevations.length - 1);
            const high = Math.min(low + 1, elevations.length - 1);
            points[i].alt = elevations[low] + (elevations[high] - elevations[low]) * (sample - low);
        }
        return points;
    }

    /**
     * Downloads an area's Valhalla extract (.tar) and untars it (natively) into
     * the shared tile directory. Call once per area you want available offline;
     * disjoint areas coexist in the same directory (Option B). Idempotent via a
     * per-area marker file.
     */
    public async addValhallaArea(name: string, url: string): Promise<void> {
        const tarFileName = `${name}.tar`;
        try {
            this.loggingService.info(`[Routing][Valhalla] downloading area ${name}...`);
            await this.fileService.downloadFileToCacheAuthenticated(url, "valhalla-tile-" + name, "", (value: number) => {
                console.log("downloading: " + value);
            }, new AbortController());
            const result = await CarPlugin.extractTiles({ tarFileName, tilesDir: VALHALLA_TILES_DIR });
            this.loggingService.info(`[Routing][Valhalla] extracted ${result.extractedFiles} tiles for ${name} into ${result.tilesDir}`);
            await Filesystem.deleteFile({ path: tarFileName, directory: Directory.Data }); // free the (large) tar
            await Filesystem.writeFile({ path: this.areaMarker(name), directory: Directory.Data, data: "", encoding: Encoding.UTF8 });
        } catch (error) {
            this.loggingService.error(`[Routing][Valhalla] failed to download area ${name}: ${error}`);
            throw error;
        }
    }

    private async ensureValhallaArea(name: string, url: string): Promise<void> {
        try {
            await Filesystem.stat({ path: this.areaMarker(name), directory: Directory.Data });
            return; // already downloaded and extracted
        } catch {
            await this.addValhallaArea(name, url);
        }
    }

    private areaMarker(name: string): string {
        return `valhalla_area_${name}.done`;
    }

    /**
     * POC helper: wipes the shared tile directory and all area markers so the
     * next route re-downloads and re-extracts the latest tar. Call once after
     * the server tar changes.
     */
    public async clearValhallaData(): Promise<void> {
        try {
            await Filesystem.rmdir({ path: VALHALLA_TILES_DIR, directory: Directory.Data, recursive: true });
        } catch { /* nothing to remove */ }
        try {
            const listing = await Filesystem.readdir({ path: ".", directory: Directory.Data });
            for (const entry of listing.files) {
                if (entry.name.startsWith("valhalla_area_") && entry.name.endsWith(".done")) {
                    await Filesystem.deleteFile({ path: entry.name, directory: Directory.Data });
                }
            }
        } catch { /* ignore */ }
        this.loggingService.info("[Routing][Valhalla] cleared tiles and markers");
    }
}
