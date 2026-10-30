import { inject, Service } from "@angular/core";
import { Store } from "@ngxs/store";

import { OverpassTurboService } from "./overpass-turbo.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { PmTilesService, TILES_ZOOM } from "./pmtiles.service";
import { SpatialHelper } from "./spatial.helper";
import { SetTileNameAction } from "../reducers/offline.reducer";
import type { ApplicationState } from "../models";

/**
 * Gives a downloaded tile a default name, after the most important places in it, or the sea or a place
 * near it when it has none, so that the list of downloaded tiles reads as places rather than coordinates. The name is stored like one the user typed,
 * so it is looked up once and does not change under the user afterwards.
 */
@Service()
export class OfflineTileNamesService {

    /** How many places a name is made of, a tile is a few hundred kilometers wide and one city is too few */
    private static readonly PLACES_IN_NAME = 2;
    private static readonly SETTLEMENT_ORDER = ["city", "town"];
    private static readonly WATER_PLACES = ["sea", "ocean"];

    private readonly overpassTurboService = inject(OverpassTurboService);
    private readonly resources = inject(ResourcesService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    /**
     * Names a tile that has no name yet. Failing to look the places up, offline for example, leaves the
     * tile without a name, to be tried again the next time.
     */
    public async nameTile(tileX: number, tileY: number): Promise<void> {
        const tileKey = PmTilesService.toTileKey(tileX, tileY);
        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState.tileNames)[tileKey] != null) {
            return;
        }
        let name: string | null;
        try {
            const places = await this.getNamedPlaces(tileX, tileY, 0);
            name = this.getSettlementsName(places, OfflineTileNamesService.PLACES_IN_NAME) ?? this.getWaterName(places);
            if (name == null) {
                const nearbyPlaces = await this.getNamedPlaces(tileX, tileY, 1);
                const nearbySettlement = this.getSettlementsName(nearbyPlaces, 1);
                name = this.getWaterName(nearbyPlaces) ??
                    (nearbySettlement == null ? null : this.resources.nearPlace.replace("{{place}}", nearbySettlement));
            }
        } catch (ex) {
            this.loggingService.warning(`[Offline Tile Names] Failed to get the places of tile ${tileKey}: ${(ex as Error).message}`);
            return;
        }
        const tileNames = this.store.selectSnapshot((s: ApplicationState) => s.offlineState.tileNames);
        if (name != null && tileNames[tileKey] == null) {
            this.store.dispatch(new SetTileNameAction(tileKey, OfflineTileNamesService.toUniqueName(name, Object.values(tileNames))));
        }
    }

    /** The named places of a tile, along with the tiles around it as far as the margin */
    private getNamedPlaces(tileX: number, tileY: number, margin: number): Promise<Record<string, string>[]> {
        return this.overpassTurboService.getNamedPlacesInArea({
            northEast: SpatialHelper.fromTile({ x: tileX + 1 + margin, y: tileY - margin }, TILES_ZOOM),
            southWest: SpatialHelper.fromTile({ x: tileX - margin, y: tileY + 1 + margin }, TILES_ZOOM)
        });
    }

    /** The names of the most important cities and towns, null when there are none */
    private getSettlementsName(places: Record<string, string>[], placesInName: number): string | null {
        const settlements = places
            .filter(p => OfflineTileNamesService.SETTLEMENT_ORDER.includes(p.place))
            .sort((a, b) => OfflineTileNamesService.compareImportance(a, b));
        const names = [...new Set(settlements.map(p => this.getLocalName(p)))];
        return names.length === 0 ? null : names.slice(0, placesInName).join(" – ");
    }

    /**
     * The name of a sea or an ocean, which a tile with no settlement is most likely in. OSM marks a sea
     * with a single node, usually far from most of its tiles, so it is also looked for around the tile.
     */
    private getWaterName(places: Record<string, string>[]): string | null {
        const water = places.find(p => OfflineTileNamesService.WATER_PLACES.includes(p.place));
        return water == null ? null : this.getLocalName(water);
    }

    /**
     * Numbers a name another tile already has, which tiles of the same sea or near the same city get,
     * so that the list never shows two tiles the user can not tell apart.
     */
    private static toUniqueName(name: string, namesInUse: string[]): string {
        let uniqueName = name;
        for (let number = 2; namesInUse.includes(uniqueName); number++) {
            uniqueName = `${name} (${number})`;
        }
        return uniqueName;
    }

    private getLocalName(tags: Record<string, string>): string {
        return tags[`name:${this.resources.getCurrentLanguageCodeSimplified()}`] ?? tags.name;
    }

    /**
     * A national capital first, then the capitals of lower admin levels, then cities before towns and
     * the larger before the smaller.
     */
    private static compareImportance(a: Record<string, string>, b: Record<string, string>): number {
        return OfflineTileNamesService.getCapitalRank(a) - OfflineTileNamesService.getCapitalRank(b) ||
            OfflineTileNamesService.SETTLEMENT_ORDER.indexOf(a.place) - OfflineTileNamesService.SETTLEMENT_ORDER.indexOf(b.place) ||
            OfflineTileNamesService.getPopulation(b) - OfflineTileNamesService.getPopulation(a);
    }

    /** The admin level a place is the capital of, where "yes" is the country's */
    private static getCapitalRank(tags: Record<string, string>): number {
        if (tags.capital === "yes") {
            return 0;
        }
        const adminLevel = parseInt(tags.capital, 10);
        return Number.isNaN(adminLevel) ? Number.MAX_SAFE_INTEGER : adminLevel;
    }

    /** The population tag is free text, "12,000" or "12000 (2020)", so only its leading digits are read */
    private static getPopulation(tags: Record<string, string>): number {
        return parseInt((tags.population ?? "").replace(/[,.\s]/g, ""), 10) || 0;
    }
}
