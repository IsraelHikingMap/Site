import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";
import QuickLRU from "quick-lru";

import { LoggingService } from "./logging.service";
import { SpatialHelper } from "./spatial.helper";
import { PmTilesService } from "./pmtiles.service";
import type { LatLngAltTime } from "../models";

@Service()
export class ElevationProvider {

    static readonly MAX_ELEVATION_ZOOM = 11;
    /** The lowest zoom a tile is looked for at when the higher zoom tiles can not be fetched */
    static readonly FALLBACK_ELEVATION_ZOOM = 9;
    static readonly ELEVATION_SCHEMA = "raster-dem";

    /** How long to wait for a terrain tile before giving up on it and trying a lower zoom */
    private static readonly TILE_TIMEOUT_MS = 3000;

    private readonly transparentPngUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";

    private readonly elevationCache = new QuickLRU<string, Uint8ClampedArray>({ maxSize: 100 });

    private readonly httpClient = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly pmTilesService = inject(PmTilesService);

    public async updateHeights(latlngs: LatLngAltTime[]): Promise<void> {
        const relevantIndexes: number[] = [];
        const missingElevation: LatLngAltTime[] = []
        for (let i = 0; i < latlngs.length; i++) {
            const latlng = latlngs[i];
            if (latlng.alt) {
                continue;
            }
            relevantIndexes.push(i);
            missingElevation.push(latlng);
        }
        if (relevantIndexes.length === 0) {
            return;
        }
        try {
            await this.populateElevationCache(latlngs);
            for (const relevantIndex of relevantIndexes) {
                const latlng = latlngs[relevantIndex];
                const elevation = this.getElevationForLatlng(latlng);
                if (elevation != null) {
                    latlng.alt = elevation;
                }
            }
        } catch (ex) {
            this.loggingService.warning(`[Elevation] Unable to get elevation data for ${latlngs.length} points. ` +
                `${(ex as Error).message}`);
        }
    }

    private async populateElevationCache(latlngs: LatLngAltTime[]) {
        const tiles = latlngs.map(latlng => SpatialHelper.toTile(latlng, ElevationProvider.MAX_ELEVATION_ZOOM));
        const tileXmax = Math.max(...tiles.map(tile => Math.floor(tile.x)));
        const tileXmin = Math.min(...tiles.map(tile => Math.floor(tile.x)));
        const tileYmax = Math.max(...tiles.map(tile => Math.floor(tile.y)));
        const tileYmin = Math.min(...tiles.map(tile => Math.floor(tile.y)));
        for (let tileX = tileXmin; tileX <= tileXmax; tileX++) {
            for (let tileY = tileYmin; tileY <= tileYmax; tileY++) {
                await this.cacheTile(tileX, tileY);
            }
        }
    }

    /**
     * Caches the terrain tile at the highest zoom, and when it can not be fetched, the tile covering the
     * same area at a lower zoom. A tile the CDN fails to serve is usually served at a different zoom, and
     * a coarser elevation is better than leaving the points without one.
     */
    private async cacheTile(tileX: number, tileY: number): Promise<void> {
        for (let zoom = ElevationProvider.MAX_ELEVATION_ZOOM; zoom >= ElevationProvider.FALLBACK_ELEVATION_ZOOM; zoom--) {
            const { tileX: zoomedTileX, tileY: zoomedTileY } = SpatialHelper.getParentZoomTileCoordinates(
                { x: tileX, y: tileY }, ElevationProvider.MAX_ELEVATION_ZOOM, zoom);
            const key = `${zoom}/${zoomedTileX}/${zoomedTileY}`;
            if (this.elevationCache.has(key)) {
                return;
            }
            try {
                const arrayBuffer = await this.getTile(zoom, zoomedTileX, zoomedTileY);
                this.elevationCache.set(key, await this.getImageData(arrayBuffer));
                return;
            } catch (ex) {
                this.loggingService.warning(`[Elevation] Unable to get the terrain tile ${key}: ${(ex as Error).message}`);
            }
        }
    }

    private async getTile(zoom: number, tileX: number, tileY: number): Promise<ArrayBuffer> {
        const useOffline = await this.pmTilesService.isOfflineFileAvailable(zoom, tileX, tileY, ElevationProvider.ELEVATION_SCHEMA);
        if (useOffline) {
            return await this.pmTilesService.getTileByType(zoom, tileX, tileY, ElevationProvider.ELEVATION_SCHEMA);
        }
        const address = `https://mapeak.com/vector/data/raster-dem/${zoom}/${tileX}/${tileY}.webp`;
        return await firstValueFrom(this.httpClient.get(address, { responseType: "arraybuffer" })
            .pipe(timeout(ElevationProvider.TILE_TIMEOUT_MS)));
    }

    /**
     * The elevation of the given point from the cached tile of the highest zoom that holds it,
     * or undefined when no tile holding it could be fetched.
     */
    private getElevationForLatlng(latlng: LatLngAltTime): number | undefined {
        for (let zoom = ElevationProvider.MAX_ELEVATION_ZOOM; zoom >= ElevationProvider.FALLBACK_ELEVATION_ZOOM; zoom--) {
            const tile = SpatialHelper.toTile(latlng, zoom);
            const data = this.elevationCache.get(`${zoom}/${Math.floor(tile.x)}/${Math.floor(tile.y)}`);
            if (data == null) {
                continue;
            }
            return this.interpolateElevation(data, latlng, zoom);
        }
        return undefined;
    }

    private interpolateElevation(data: Uint8ClampedArray, latlng: LatLngAltTime, zoom: number): number {
        const tileSize = 512;
        const relative = SpatialHelper.toRelativePixelCenter(latlng, zoom, tileSize);
        // Get the coordinates of the center of the top-left pixel
        const pixelX1 = Math.floor(relative.pixelX);
        const pixelY1 = Math.floor(relative.pixelY);

        // Get the coordinates of the other three nearest pixels
        const pixelX2 = Math.min(pixelX1 + 1, tileSize - 1);
        const pixelY2 = Math.min(pixelY1 + 1, tileSize - 1);

        // Get the elevations of the four nearest pixels
        const elevation1 = this.getPixelElevation(data, pixelX1, pixelY1, tileSize);
        const elevation2 = this.getPixelElevation(data, pixelX2, pixelY1, tileSize);
        const elevation3 = this.getPixelElevation(data, pixelX1, pixelY2, tileSize);
        const elevation4 = this.getPixelElevation(data, pixelX2, pixelY2, tileSize);

        // Get the fractional part of the coordinates for interpolation
        const dx = relative.pixelX - pixelX1;
        const dy = relative.pixelY - pixelY1;

        // Perform bilinear interpolation
        const elevationX1 = elevation1 * (1 - dx) + elevation2 * dx;
        const elevationX2 = elevation3 * (1 - dx) + elevation4 * dx;
        return elevationX1 * (1 - dy) + elevationX2 * dy;
    }

    private getPixelElevation(data: Uint8ClampedArray, x: number, y: number, tileSize: number): number {
        const index = (y * tileSize + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        return -32768 + ((r * 256 + g + b / 256.0));
    }

    private async getImageData(data: ArrayBuffer): Promise<Uint8ClampedArray> {
        const imageBitmapSupported = typeof createImageBitmap === "function";
        const blob: Blob = new Blob([new Uint8Array(data)], { type: "image/webp" });
        const img = imageBitmapSupported
            ? await createImageBitmap(blob)
            : await this.arrayBufferToImage(blob);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        return imgData.data;
    }

    private arrayBufferToImage(blob: Blob): Promise<HTMLImageElement> {
        return new Promise((resolve, reject) => {
            const img: HTMLImageElement = new Image();
            img.onload = () => {
                resolve(img);
                URL.revokeObjectURL(img.src);
                // prevent image dataURI memory leak in Safari;
                // but don't free the image immediately because it might be uploaded in the next frame
                // https://github.com/mapbox/mapbox-gl-js/issues/10226
                img.onload = null;
                window.requestAnimationFrame(() => { img.src = this.transparentPngUrl; });
            };
            img.onerror = () => reject(new Error("Could not load image"));

            img.src = URL.createObjectURL(blob);
        });
    }
}
