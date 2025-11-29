import { Injectable } from "@angular/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { decode } from "base64-arraybuffer";
import { Source, RangeResponse, PMTiles } from "pmtiles";

class CapacitorSource implements Source {

    constructor(private filePath: string, private directory: Directory) {}

    async getBytes(offset: number, length: number): Promise<RangeResponse> {
        // Read a chunk of the file using Capacitor Filesystem
        // Since Capacitor Filesystem doesn't support range reads directly,
        // we need to read the whole file and slice it (or use a workaround)
        // For better performance with large files, consider using a native plugin
        const result = await Filesystem.readFile({
            path: this.filePath,
            directory: this.directory
        });

        const fullBuffer = decode(result.data as string);
        const slicedBuffer = fullBuffer.slice(offset, offset + length);
        return { data: slicedBuffer };
    }

    getKey() { return this.filePath; }
}

@Injectable()
export class PmTilesService {

    private sourcesCache = new Map<string, CapacitorSource>();

    private async getSource(filePath: string): Promise<Source> {
        if (this.sourcesCache.has(filePath)) {
            return this.sourcesCache.get(filePath);
        }

        const source = new CapacitorSource(filePath, Directory.Data);
        this.sourcesCache.set(filePath, source);
        return source;
    }

    /**
     * Get's a tile from the stored pmtiles file
     * @param url - should be something like custom://filename-without-pmtiles-extention/{z}/{x}/{y}.png
     * @returns 
     */
    public async getTile(url: string): Promise<ArrayBuffer> {
        const splitUrl = url.split("/");
        const fileName = splitUrl[2] + ".pmtiles";
        const z = +splitUrl[splitUrl.length - 3];
        const x = +splitUrl[splitUrl.length - 2];
        const y = +(splitUrl[splitUrl.length - 1].split(".")[0]);
        const source = await this.getSource(fileName);
        const pmTilesProvider = new PMTiles(source);
        const response = await pmTilesProvider.getZxy(z, x, y);
        return response.data;
    }
}