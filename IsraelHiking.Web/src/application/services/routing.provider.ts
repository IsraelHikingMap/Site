import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import polyline from "@mapbox/polyline";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import { RunningContextService } from "./running-context.service";
import { ElevationProvider } from "./elevation.provider";
import { Valhalla } from "./valhalla.plugin";
import type { ValhallaRouteLeg, ValhallaRouteResponse } from "./valhalla.plugin";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAltTime, RoutingType } from "../models";

@Service()
export class RoutingProvider {
    /** The app's routing type is not a valhalla costing model */
    private static readonly VALHALLA_COSTING: Record<RoutingType, string> = {
        Hike: "pedestrian",
        Bike: "bicycle",
        "4WD": "auto",
        None: "auto"
    };

    /** Matches the resolution of valhalla's elevation data */
    private static readonly ELEVATION_INTERVAL_METERS = 30;

    /** The zoom level the offline files are sliced at, see the server's OfflineFilesService */
    private static readonly SLICE_TILE_ZOOM = 7;

    private static readonly ROUTING_TILES_PREFIX = "valhalla";
    private static readonly ROUTING_TILES_EXTENSION = ".tar";

    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly loggingService = inject(LoggingService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly elevationProvider = inject(ElevationProvider);
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
            const data = await firstValueFrom(this.httpClient.get<GeoJSON.FeatureCollection<GeoJSON.LineString>>(address).pipe(timeout(4500)));
            return data.features[0].geometry.coordinates.map(c => SpatialService.toLatLng(c));
        } catch (ex) {
            try {
                return await this.getOffineRoute(latlngStart, latlngEnd, routinType);
            } catch (ex2) {
                this.loggingService.error(`[Routing] failed: ${(ex as Error).message}, ${(ex2 as Error).message}`);
                this.toastService.warning(this.getRoutingFailedMessage(latlngStart, latlngEnd));
                const lngLat = [latlngStart, latlngEnd];
                this.elevationProvider.updateHeights(lngLat);
                return lngLat;
            }
        }
    }

    /**
     * Explains why the route could not be calculated: a user without a subscription cannot route
     * offline at all, a subscribed user who did not download the area this route is in should
     * download it, and when the tiles are there no route could be found between the points.
     */
    private getRoutingFailedMessage(latlngStart: LatLngAltTime, latlngEnd: LatLngAltTime): string {
        if (!this.runningContextService.isCapacitor) {
            return this.resources.routingFailed;
        }
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        if (!offlineState.isSubscribed) {
            return this.resources.routingFailedBuySubscription;
        }
        return this.areRoutingTilesDownloaded([latlngStart, latlngEnd])
            ? this.resources.routingFailed
            : this.resources.routingFailedDownloadTheArea;
    }

    /**
     * Whether the slices holding the given points were downloaded along with their routing tiles.
     * A slice that was downloaded before offline routing existed holds no routing tiles, so it
     * needs to be downloaded again.
     */
    private areRoutingTilesDownloaded(latlngs: LatLngAltTime[]): boolean {
        const downloadedTiles = this.store.selectSnapshot((s: ApplicationState) => s.offlineState).downloadedTiles;
        if (downloadedTiles == null) {
            return false;
        }
        return latlngs.every(latlng => {
            const tile = SpatialService.toTile(latlng, RoutingProvider.SLICE_TILE_ZOOM);
            const files = downloadedTiles[`${Math.floor(tile.x)}-${Math.floor(tile.y)}`];
            return Array.isArray(files) && files.some(file => RoutingProvider.isRoutingTilesFile(file.fileName));
        });
    }

    /**
     * Whether the given offline file is a slice of routing tiles, as the server names them.
     */
    public static isRoutingTilesFile(fileName: string): boolean {
        return fileName.startsWith(RoutingProvider.ROUTING_TILES_PREFIX) &&
            fileName.endsWith(RoutingProvider.ROUTING_TILES_EXTENSION);
    }

    /**
     * Extracts a downloaded offline routing tiles file, the file itself is removed once extracted.
     * The slice is identified so that it can later be removed without affecting its neighbours.
     */
    public async extractOfflineRoutingTiles(fileName: string, sliceId: string): Promise<void> {
        const results = await Valhalla.extractTiles({ tarFileName: fileName, sliceId });
        this.loggingService.info(`[Routing] Extracted ${results.extractedFiles} offline routing tiles from ${fileName}`);
    }

    /**
     * Removes the offline routing tiles of a single slice, the tiles it shares with its neighbours are kept.
     */
    public async deleteOfflineRoutingTiles(sliceId: string): Promise<void> {
        await Valhalla.deleteTiles({ sliceId });
        this.loggingService.info(`[Routing] Removed the offline routing tiles of ${sliceId}`);
    }

    /**
     * Calculates a route between the two given points using the tiles on the device.
     * The returned points have their elevation set from valhalla's elevation samples.
     */
    private async getOffineRoute(latlngStart: LatLngAltTime, latlngEnd: LatLngAltTime, routingType: RoutingType): Promise<LatLngAltTime[]> {
        if (!(await Valhalla.hasTiles()).hasTiles) {
            throw new Error("[Routing] There are no offline routing tiles on the device");
        }
        const results = await Valhalla.route({
            fromLat: latlngStart.lat,
            fromLng: latlngStart.lng,
            toLat: latlngEnd.lat,
            toLng: latlngEnd.lng,
            costing: RoutingProvider.VALHALLA_COSTING[routingType],
            elevationInterval: RoutingProvider.ELEVATION_INTERVAL_METERS
        });
        const latlngs = RoutingProvider.parseValhallaResponse(results.raw);
        this.loggingService.info(`[Routing] Got an offline route with ${latlngs.length} points`);
        return latlngs;
    }

    /**
     * Turns a raw valhalla response into the route's points. Static and public so it can be tested
     * without the native plugin, which has no web implementation to stand in for it.
     */
    public static parseValhallaResponse(raw: string): LatLngAltTime[] {
        const response = JSON.parse(raw) as ValhallaRouteResponse;
        if (response.trip == null) {
            throw new Error(`[Routing] Offline routing failed with code ${response.code}: ${response.message}`);
        }
        return (response.trip.legs ?? []).flatMap(leg => RoutingProvider.valhallaLegToLatLngs(leg));
    }

    /**
     * Decodes a leg's shape and sets the elevation of every point by interpolating between the
     * elevation samples, which are evenly spaced along the leg.
     */
    private static valhallaLegToLatLngs(leg: ValhallaRouteLeg): LatLngAltTime[] {
        const points: LatLngAltTime[] = polyline.decode(leg.shape ?? "", 6).map(([lat, lng]) => ({ lat, lng }));
        const elevations = leg.elevation ?? [];
        if (elevations.length === 0) {
            return points;
        }
        let cumulativeDistance = 0;
        for (let index = 0; index < points.length; index++) {
            if (index > 0) {
                cumulativeDistance += SpatialService.getDistanceInMeters(points[index - 1], points[index]);
            }
            const sample = cumulativeDistance / RoutingProvider.ELEVATION_INTERVAL_METERS;
            const low = Math.min(Math.floor(sample), elevations.length - 1);
            const high = Math.min(low + 1, elevations.length - 1);
            points[index].alt = elevations[low] + (elevations[high] - elevations[low]) * (sample - low);
        }
        return points;
    }
}
