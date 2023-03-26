import { Injectable } from "@angular/core";
import { HttpClient, HttpParams } from "@angular/common/http";
import { NgRedux } from "@angular-redux2/store";
import { timeout } from "rxjs/operators";
import { firstValueFrom } from "rxjs";

import { ResourcesService } from "./resources.service";
import { ToastService } from "./toast.service";
import { LoggingService } from "./logging.service";
import { SpatialService } from "./spatial.service";
import { DatabaseService } from "./database.service";
import { Urls } from "../urls";
import type { ApplicationState, LatLngAlt } from "../models/models";

@Injectable()
export class ElevationProvider {

    private readonly transparentPngUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQYV2NgAAIAAAUAAarVyFEAAAAASUVORK5CYII=";

    private elevationCache: Map<string, Uint8ClampedArray>;

    constructor(private readonly httpClient: HttpClient,
                private readonly resources: ResourcesService,
                private readonly toastService: ToastService,
                private readonly loggingService: LoggingService,
                private readonly databaseService: DatabaseService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        this.elevationCache = new Map<string, Uint8ClampedArray>();
    }

    public async updateHeights(latlngs: LatLngAlt[]): Promise<void> {
        let relevantIndexes = [] as number[];
        let points = [] as string[];
        for (let i = 0; i < latlngs.length; i++) {
            let latlng = latlngs[i];
            if (latlng.alt) {
                continue;
            }
            relevantIndexes.push(i);
            points.push(`${latlng.lat.toFixed(6)},${latlng.lng.toFixed(6)}`);
        }
        if (relevantIndexes.length === 0) {
            return;
        }
        try {
            let params = new HttpParams().set("points", points.join("|"));
            let response = await firstValueFrom(this.httpClient.get(Urls.elevation, { params }).pipe(timeout(1000)));
            for (let index = 0; index < relevantIndexes.length; index++) {
                latlngs[relevantIndexes[index]].alt = (response as number[])[index];
            }
        } catch (ex) {
            try {
                await this.populateElevationCache(latlngs);
                for (let relevantIndexe of relevantIndexes) {
                    let latlng = latlngs[relevantIndexe];
                    latlng.alt = this.getElevationForLatlng(latlng);
                }
            } catch (ex2) {
                this.loggingService.warning(`[Elevation] Unable to get elevation data for ${latlngs.length} points. ` +
                    `${(ex as Error).message}, ${(ex2 as Error).message}`);
                this.toastService.warning(this.resources.unableToGetElevationData);
            }
        }
    }

    private async populateElevationCache(latlngs: LatLngAlt[]) {
        let offlineState = this.ngRedux.getState().offlineState;
        if (!offlineState.isOfflineAvailable || offlineState.lastModifiedDate == null) {
            throw new Error("[Elevation] Getting elevation is only supported after downloading offline data");
        }
        const zoom = 12; // elevation tiles are at zoom 12
        let tiles = latlngs.map(latlng => SpatialService.toTile(latlng, zoom));
        const tileXmax = Math.max(...tiles.map(tile => Math.floor(tile.x)));
        const tileXmin = Math.min(...tiles.map(tile => Math.floor(tile.x)));
        const tileYmax = Math.max(...tiles.map(tile => Math.floor(tile.y)));
        const tileYmin = Math.min(...tiles.map(tile => Math.floor(tile.y)));
        if (tileXmax - tileXmin > 1 || tileYmax - tileYmin > 1) {
            throw new Error("[Elevation] Getting elevation is only supported for adjecent tiles maximum...");
        }
        for (let tileX = tileXmin; tileX <= tileXmax; tileX++) {
            for (let tileY = tileYmin; tileY <= tileYmax; tileY++) {
                let key = `${tileX}/${tileY}`;
                if (this.elevationCache.has(key)) {
                    continue;
                }

                let arrayBuffer = await this.databaseService.getTile(`custom://TerrainRGB/${zoom}/${tileX}/${tileY}.png`);
                let data = await this.getImageData(arrayBuffer);
                this.elevationCache.set(key, data);
        }
      }
    }

    private getElevationForLatlng(latlng: LatLngAlt): number {
        const zoom = 12;
        const tileSize = 256;
        let tile = SpatialService.toTile(latlng, zoom);
        let relative = SpatialService.toRelativePixel(latlng, zoom, tileSize);
        let tileIndex = { tileX: Math.floor(tile.x), tileY: Math.floor(tile.y) };
        let data = this.elevationCache.get(`${tileIndex.tileX}/${tileIndex.tileY}`);
        const r = data[(relative.pixelY * tileSize + relative.pixelX) * 4];
        const g = data[(relative.pixelY * tileSize + relative.pixelX) * 4 + 1];
        const b = data[(relative.pixelY * tileSize + relative.pixelX) * 4 + 2];
        return -10000 + ((r * 256 * 256 + g * 256 + b) * 0.1);
    }

    private async getImageData(data: ArrayBuffer): Promise<Uint8ClampedArray> {
        const imageBitmapSupported = typeof createImageBitmap === "function";
        const blob: Blob = new Blob([new Uint8Array(data)], {type: "image/png"});
        let img = imageBitmapSupported
            ? await createImageBitmap(blob)
            : await this.arrayBufferToImage(blob);
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0, img.width, img.height);

        const imgData = ctx.getImageData(0, 0, img.width, img.height);
        return imgData.data;
    };

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
