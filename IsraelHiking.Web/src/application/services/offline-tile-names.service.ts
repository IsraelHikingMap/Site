import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { OfflineAreasService } from "./offline-areas.service";
import { LoggingService } from "./logging.service";
import { PmTilesService } from "./pmtiles.service";
import { Urls } from "../urls";
import type { ApplicationState, OfflineArea } from "../models";

/**
 * Gives a downloaded tile the names the server has for it, so that the list of downloaded areas reads as places
 * rather than coordinates. The names are kept with the tile like the names of any other area, so they are looked
 * up once and do not change under the user afterwards.
 */
@Service()
export class OfflineTileNamesService {

    private readonly httpClient = inject(HttpClient);
    private readonly offlineAreasService = inject(OfflineAreasService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    /**
     * Names a downloaded tile that has no name yet. Failing to get its names, offline for example, leaves the tile
     * without a name, to be tried again the next time.
     */
    public async nameTile(area: Immutable<OfflineArea>): Promise<void> {
        const id = area.properties.id;
        const tile = PmTilesService.fromTileKey(id);
        if (tile == null || area.properties.name != null) {
            return;
        }
        let names: Record<string, string>;
        try {
            names = await firstValueFrom(this.httpClient.get<Record<string, string>>(Urls.offlineTileName, { params: { tileX: tile.tileX, tileY: tile.tileY } }));
        } catch (ex) {
            this.loggingService.warning(`[Offline Tile Names] Failed to get the name of tile ${id}: ${(ex as Error).message}`);
            return;
        }
        const downloadedAreas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        const tileArea = downloadedAreas[id]?.area;
        if (names?.name == null || tileArea == null || tileArea.properties.name != null) {
            return;
        }
        const namesInUse = Object.entries(downloadedAreas)
            .filter(([key, other]) => key !== id && other.area != null)
            .map(([, other]) => this.offlineAreasService.getName(other.area));
        const suffix = OfflineTileNamesService.getUniqueSuffix(this.offlineAreasService.getName({ ...area, properties: { ...names, id } }), namesInUse);
        const properties = Object.fromEntries(Object.entries(names).map(([key, name]) => [key, name + suffix]));
        await this.offlineAreasService.saveDownloadedArea(OfflineAreasService.withNames(tileArea, properties));
    }

    /**
     * What a name another area already goes by is numbered with, which neighboring tiles can get, so that the list
     * never shows two areas the user can not tell apart. The same number is given to the name in every language.
     */
    private static getUniqueSuffix(name: string, namesInUse: string[]): string {
        let suffix = "";
        for (let number = 2; namesInUse.includes(name + suffix); number++) {
            suffix = ` (${number})`;
        }
        return suffix;
    }
}
