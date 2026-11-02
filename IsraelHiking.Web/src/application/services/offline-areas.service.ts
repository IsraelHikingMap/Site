import { inject, Service } from "@angular/core";
import { HttpClient } from "@angular/common/http";
import { firstValueFrom } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";
import { bbox } from "@turf/bbox";
import { booleanPointInPolygon } from "@turf/boolean-point-in-polygon";
import type { LngLat } from "maplibre-gl";

import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { FileService } from "./file.service";
import { PmTilesService, TILES_ZOOM } from "./pmtiles.service";
import { SpatialHelper } from "./spatial.helper";
import { SetDownloadedAreasAction } from "../reducers/in-memory.reducer";
import { Urls } from "../urls";
import type { ApplicationState, OfflineArea } from "../models";

/**
 * The areas that can be downloaded for offline usage and the ones that were. A downloaded area is kept on the
 * device in a file of its own next to its map files, since the areas the server offers can change after it was
 * downloaded and an area is updated by sending it as it was.
 */
@Service()
export class OfflineAreasService {
    /** What the name of the file an area is kept in ends with, after the id of the area */
    private static readonly AREA_FILE_SUFFIX = ".area.json";

    private readonly httpClient = inject(HttpClient);
    private readonly resources = inject(ResourcesService);
    private readonly loggingService = inject(LoggingService);
    private readonly fileService = inject(FileService);
    private readonly store = inject(Store);

    /** The areas that can be downloaded, none when they can not be fetched, offline for example */
    public async getAreas(): Promise<OfflineArea[]> {
        try {
            const areas = await firstValueFrom(this.httpClient.get<GeoJSON.FeatureCollection>(Urls.offlineAreas));
            return areas.features as OfflineArea[];
        } catch (ex) {
            this.loggingService.warning(`[Offline Areas] Failed to get the areas: ${(ex as Error).message}`);
            return [];
        }
    }

    /** The name of an area in the language of the app, in English when it has none in it, none for a tile that was not named yet */
    public getName(area: Immutable<OfflineArea>): string | undefined {
        return area.properties[`name:${this.resources.getCurrentLanguageCodeSimplified()}`] ?? area.properties.name;
    }

    /**
     * The area at a point, the smallest of them where areas overlap, like Berlin in Brandenburg, since the larger
     * one has the rest of itself to be clicked on.
     */
    public findArea(areas: OfflineArea[], lngLat: LngLat): OfflineArea | null {
        return areas
            .filter(area => booleanPointInPolygon([lngLat.lng, lngLat.lat], area))
            .sort((a, b) => OfflineAreasService.getBoundsArea(a) - OfflineAreasService.getBoundsArea(b))[0] ?? null;
    }

    /**
     * Reads the areas that are kept on the device into the state. A file that can not be read is skipped, which
     * leaves its files listed by the id of the area until they are downloaded again.
     */
    public async loadDownloadedAreas(): Promise<Record<string, OfflineArea>> {
        const areas: Record<string, OfflineArea> = {};
        for (const fileName of await this.fileService.listFileNamesInDataDirectory(OfflineAreasService.AREA_FILE_SUFFIX)) {
            try {
                const area = JSON.parse(await this.fileService.readFileInDataDirectory(fileName)) as OfflineArea;
                areas[area.properties.id] = area;
            } catch (ex) {
                this.loggingService.warning(`[Offline Areas] Failed to read ${fileName}: ${(ex as Error).message}`);
            }
        }
        this.store.dispatch(new SetDownloadedAreasAction(areas));
        return areas;
    }

    public async saveDownloadedArea(area: Immutable<OfflineArea>): Promise<void> {
        await this.fileService.writeFileInDataDirectory(OfflineAreasService.getAreaFileName(area.properties.id), JSON.stringify(area));
        const areas = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas);
        this.store.dispatch(new SetDownloadedAreasAction({ ...areas, [area.properties.id]: area }));
    }

    public async deleteDownloadedArea(id: string): Promise<void> {
        await this.fileService.deleteFileInDataDirectory(OfflineAreasService.getAreaFileName(id));
        const areas = { ...this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState.downloadedAreas) };
        delete areas[id];
        this.store.dispatch(new SetDownloadedAreasAction(areas));
    }

    /** Names a downloaded area the way the user typed it, in every language, since that is the name they will look for */
    public renameDownloadedArea(area: Immutable<OfflineArea>, name: string): Promise<void> {
        return this.saveDownloadedArea({ ...area, properties: { id: area.properties.id, name } });
    }

    /** A tile as an area, whose id is the key of the tile, see PmTilesService */
    public static createTileArea(tileX: number, tileY: number): OfflineArea {
        const corners = [[tileX, tileY], [tileX + 1, tileY], [tileX + 1, tileY + 1], [tileX, tileY + 1], [tileX, tileY]]
            .map(([x, y]) => SpatialHelper.toCoordinate(SpatialHelper.fromTile({ x, y }, TILES_ZOOM)));
        return { type: "Feature", properties: { id: PmTilesService.toTileKey(tileX, tileY) }, geometry: { type: "Polygon", coordinates: [corners] } };
    }

    private static getAreaFileName(id: string): string {
        return id + OfflineAreasService.AREA_FILE_SUFFIX;
    }

    private static getBoundsArea(area: OfflineArea): number {
        const [minLng, minLat, maxLng, maxLat] = bbox(area);
        return (maxLng - minLng) * (maxLat - minLat);
    }
}
