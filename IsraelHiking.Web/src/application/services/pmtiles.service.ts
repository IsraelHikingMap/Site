import { inject, Service } from "@angular/core";
import { Directory, Filesystem } from "@capacitor/filesystem";
import { Source, RangeResponse, PMTiles } from "pmtiles";
import { Store } from "@ngxs/store";
import { decode } from "base64-arraybuffer";

import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import type { ApplicationState } from "../models";

export const TILES_ZOOM = 7;

class CapacitorSource implements Source {

    constructor(private readonly path: string) { }

    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        const content = await Filesystem.readFile({
            path: this.path,
            directory: Directory.Data,
            offset: offset,
            length: length
        });
        const data = decode(content.data as string);
        return { data };
    }

    getKey() { return this.path }
}

@Service()
export class PmTilesService {

    private readonly sourcesCache = new Map<string, CapacitorSource>;

    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    /**
     * Creates a source for the given file, throws when the file does not exist.
     * Only existing files are cached, so a file that was downloaded later will be picked up.
     */
    private async getSource(filePath: string): Promise<Source> {
        if (this.sourcesCache.has(filePath)) {
            return this.sourcesCache.get(filePath);
        }
        await Filesystem.stat({ path: filePath, directory: Directory.Data });
        const source = new CapacitorSource(filePath);
        this.sourcesCache.set(filePath, source);
        return source;
    }

    /**
     * Removes a file from the sources cache, should be called when a file is deleted.
     */
    public invalidateFile(fileName: string): void {
        this.sourcesCache.delete(fileName);
    }

    /**
     * Get's a tile from the stored pmtiles file
     * @param url - should be something like custom://filename-without-pmtiles-extention/{z}/{x}/{y}.png
     * @returns 
     */
    public async getTileByUrl(url: string): Promise<ArrayBuffer> {
        const splitUrl = url.split("/");
        const fileName = splitUrl[2] + ".pmtiles";
        const z = +splitUrl[splitUrl.length - 3];
        const x = +splitUrl[splitUrl.length - 2];
        const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);
        return await this.getTileFromFile(fileName, z, x, y);
    }

    public async getTileByType(z: number, x: number, y: number, type: string): Promise<ArrayBuffer> {
        const fileName = this.getFileNameByType(z, x, y, type);
        return await this.getTileFromFile(fileName, z, x, y);
    }

    private getFileNameByType(z: number, x: number, y: number, type: string): string {
        if (z >= TILES_ZOOM) {
            const { tileX, tileY } = SpatialService.getParentZoomTileCoordinates({ x, y }, z, TILES_ZOOM);
            return `${type}+${TILES_ZOOM}-${tileX}-${tileY}.pmtiles`;
        } else {
            return `${type}-${TILES_ZOOM - 1}.pmtiles`;
        }
    }

    /**
     * A pmtiles file is sparse - tiles without any data are simply not stored in it,
     * so a missing tile is returned as an empty tile and not as an error.
     */
    private async getTileFromFile(fileName: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
        const source = await this.getSource(fileName);
        const pmTilesProvider = new PMTiles(source);
        const response = await pmTilesProvider.getZxy(z, x, y);
        return response?.data ?? new ArrayBuffer(0);
    }

    public async isOfflineFileAvailable(z: number, x: number, y: number, type: string): Promise<boolean> {
        if (this.store.selectSnapshot((state: ApplicationState) => state.offlineState).isSubscribed === false) {
            return false;
        }
        let tileX = undefined;
        let tileY = undefined;
        if (z >= TILES_ZOOM) {
            ({ tileX, tileY } = SpatialService.getParentZoomTileCoordinates({ x, y }, z, TILES_ZOOM));
        }
        if (this.store.selectSnapshot((state: ApplicationState) => state.offlineState).downloadedTiles?.[`${tileX}-${tileY}`] == null) {
            return false;
        }
        const fileName = this.getFileNameByType(z, x, y, type);
        try {
            await this.getSource(fileName);
        } catch (ex) {
            this.loggingService.debug(`Failed to open file ${fileName} for tile ${tileX}-${tileY} type ${type} and ${z}/${x}/${y}: ${(ex as Error).message}`);
            return false;
        }
        return true;
    }

    public async getVersion(fileName: string): Promise<string> {
        const source = await this.getSource(fileName);
        const pmTilesProvider = new PMTiles(source);
        return (await pmTilesProvider.getMetadata() as { version?: string })?.version;
    }
}