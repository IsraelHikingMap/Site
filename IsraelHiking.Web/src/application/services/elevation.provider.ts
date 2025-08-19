import { inject, Injectable } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { Store } from "@ngxs/store";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { LoggingService } from "./logging.service";
import { SpatialService } from "./spatial.service";
import { PmTilesService } from "./pmtiles.service";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAlt } from "../models";

@Injectable()
export class ElevationProvider {

    private readonly transparentPngUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";

    private elevationCache = new Map<string, Uint8ClampedArray>();

    private readonly httpClient = inject(HttpClient);
    private readonly loggingService = inject(LoggingService);
    private readonly pmTilesService = inject(PmTilesService);
    private readonly store = inject(Store);

    public async updateHeights(latlngs: LatLngAlt[]): Promise<void> {
        const relevantIndexes = [] as number[];
        const missingElevation = [] as LatLngAlt[]
        let isInIsrael = true;
        for (let i = 0; i < latlngs.length; i++) {
            const latlng = latlngs[i];
            if (latlng.alt) {
                continue;
            }
            relevantIndexes.push(i);
            missingElevation.push(latlng);
            if (!SpatialService.isInIsrael(latlng)) {
                isInIsrael = false;
            }
        }
        if (relevantIndexes.length === 0) {
            return;
        }
        if (!isInIsrael) {
            const body = {
                id: "valhalla_height",
                range: false,
                shape: missingElevation.map(l => ({ lat: l.lat, lon: l.lng}))
            };
            const response = await firstValueFrom(this.httpClient.post<{ height: number[]}>("https://valhalla1.openstreetmap.de/height", body));
            for (let index = 0; index < relevantIndexes.length; index++) {
                latlngs[relevantIndexes[index]].alt = response.height[index];
            }
            return;
        }

        try {
            const points = missingElevation.map(latlng => [latlng.lng, latlng.lat]);
            const response = await firstValueFrom(this.httpClient.post<number[]>(Urls.elevation, points).pipe(timeout(1000)));
            for (let index = 0; index < relevantIndexes.length; index++) {
                latlngs[relevantIndexes[index]].alt = response[index];
            }
        } catch (ex) {
            try {
                await this.populateElevationCache(latlngs);
                for (const relevantIndexe of relevantIndexes) {
                    const latlng = latlngs[relevantIndexe];
                    latlng.alt = this.getElevationForLatlng(latlng);
                }
            } catch (ex2) {
                this.loggingService.warning(`[Elevation] Unable to get elevation data for ${latlngs.length} points. ` +
                    `${(ex as Error).message}, ${(ex2 as Error).message}`);
            }
        }
    }

    private async populateElevationCache(latlngs: LatLngAlt[]) {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        if (!offlineState.isOfflineAvailable || offlineState.lastModifiedDate == null) {
            throw new Error("[Elevation] Getting elevation is only supported after downloading offline data");
        }
        const zoom = 12; // elevation tiles are at zoom 12
        const tiles = latlngs.map(latlng => SpatialService.toTile(latlng, zoom));
        const tileXmax = Math.max(...tiles.map(tile => Math.floor(tile.x)));
        const tileXmin = Math.min(...tiles.map(tile => Math.floor(tile.x)));
        const tileYmax = Math.max(...tiles.map(tile => Math.floor(tile.y)));
        const tileYmin = Math.min(...tiles.map(tile => Math.floor(tile.y)));
        for (let tileX = tileXmin; tileX <= tileXmax; tileX++) {
            for (let tileY = tileYmin; tileY <= tileYmax; tileY++) {
                const key = `${tileX}/${tileY}`;
                if (this.elevationCache.has(key)) {
                    continue;
                }

                const arrayBuffer = await this.pmTilesService.getTile(`custom://TerrainRGB/${zoom}/${tileX}/${tileY}.png`);
                const data = await this.getImageData(arrayBuffer);
                this.elevationCache.set(key, data);
        }
      }
    }

    private getElevationForLatlng(latlng: LatLngAlt): number {
        const zoom = 12;
        const tileSize = 256;
        const tile = SpatialService.toTile(latlng, zoom);
        const relative = SpatialService.toRelativePixel(latlng, zoom, tileSize);
        const tileIndex = { tileX: Math.floor(tile.x), tileY: Math.floor(tile.y) };
        const data = this.elevationCache.get(`${tileIndex.tileX}/${tileIndex.tileY}`);
        const r = data[(relative.pixelY * tileSize + relative.pixelX) * 4];
        const g = data[(relative.pixelY * tileSize + relative.pixelX) * 4 + 1];
        const b = data[(relative.pixelY * tileSize + relative.pixelX) * 4 + 2];
        return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
    }

    private async getImageData(data: ArrayBuffer): Promise<Uint8ClampedArray> {
        const imageBitmapSupported = typeof createImageBitmap === "function";
        const blob: Blob = new Blob([new Uint8Array(data)], {type: "image/png"});
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
