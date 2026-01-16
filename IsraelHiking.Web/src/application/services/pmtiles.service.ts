import { inject, Injectable } from "@angular/core";
import { File as FileSystemWrapper, IFile } from "@awesome-cordova-plugins/file/ngx";
import { Source, RangeResponse, PMTiles } from "pmtiles";
import { Store } from "@ngxs/store";

import { SpatialService } from "./spatial.service";
import { LoggingService } from "./logging.service";
import type { ApplicationState } from "../models";

export const TILES_ZOOM = 7;

class CapacitorSource implements Source {

    constructor(private file: IFile) { }

    getBytes(offset: number, length: number): Promise<RangeResponse> {
        const slice = this.file.slice(offset, offset + length);
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const arrayBuffer = event.target.result as ArrayBuffer;
                resolve({ data: arrayBuffer });
            };
            reader.onerror = () => {
                reject(new Error("Unable to read file: " + this.file.name));
            }
            reader.readAsArrayBuffer(slice);
        })
    }

    getKey() { return this.file.name }
}

@Injectable()
export class PmTilesService {

    private sourcesCache = new Map<string, CapacitorSource>;

    private readonly fileStsyemWrapper = inject(FileSystemWrapper);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    private async getSource(filePath: string): Promise<Source> {
        if (this.sourcesCache.has(filePath)) {
            return this.sourcesCache.get(filePath);
        }
        const dir = await this.fileStsyemWrapper.resolveDirectoryUrl(this.fileStsyemWrapper.dataDirectory);
        const file = await this.fileStsyemWrapper.getFile(dir, filePath, { create: false });
        return new Promise((resolve, reject) => {
            file.file((file) => {
                const source = new CapacitorSource(file);
                this.sourcesCache.set(filePath, source);
                resolve(source);
            }, reject);
        });
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

    private async getTileFromFile(fileName: string, z: number, x: number, y: number): Promise<ArrayBuffer> {
        const source = await this.getSource(fileName);
        const pmTilesProvider = new PMTiles(source);
        const response = await pmTilesProvider.getZxy(z, x, y);
        if (response == null) {
            throw new Error(`Response is null for tile ${z}/${x}/${y} from file ${fileName}`);
        }
        return response.data;
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
        if (this.store.selectSnapshot((state: ApplicationState) => state.offlineState).downloadedTiles[`${tileX}-${tileY}`] == null) {
            return false;
        }
        const fileName = this.getFileNameByType(z, x, y, type);
        try {
            await this.getSource(fileName);
        } catch (ex) {
            this.loggingService.error(`Failed to open file ${fileName} for tile ${tileX}-${tileY} type ${type} and ${z}/${x}/${y}: ${(ex as Error).message}`);
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