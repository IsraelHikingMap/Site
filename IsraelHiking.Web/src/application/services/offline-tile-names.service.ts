import { inject, Service } from "@angular/core";
import { Store } from "@ngxs/store";

import { OverpassTurboService, type AdminRegion } from "./overpass-turbo.service";
import { ResourcesService } from "./resources.service";
import { LoggingService } from "./logging.service";
import { PmTilesService, TILES_ZOOM } from "./pmtiles.service";
import { SpatialHelper } from "./spatial.helper";
import { SetTileNameAction } from "../reducers/offline.reducer";
import type { ApplicationState, Bounds, LatLngAltTime } from "../models";

/**
 * Gives a downloaded tile a default name, after the region its center is in, so that the list of downloaded
 * tiles reads as places rather than coordinates. The name is stored like one the user typed, so it is looked
 * up once and does not change under the user afterwards.
 */
@Service()
export class OfflineTileNamesService {

    private readonly overpassTurboService = inject(OverpassTurboService);
    private readonly resources = inject(ResourcesService);
    private readonly loggingService = inject(LoggingService);
    private readonly store = inject(Store);

    /**
     * Names a tile that has no name yet. Failing to look the regions up, offline for example, leaves the
     * tile without a name, to be tried again the next time.
     */
    public async nameTile(tileX: number, tileY: number): Promise<void> {
        const tileKey = PmTilesService.toTileKey(tileX, tileY);
        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState.tileNames)[tileKey] != null) {
            return;
        }
        let regions: AdminRegion[];
        try {
            regions = await this.overpassTurboService.getAdminRegionsInArea({
                northEast: SpatialHelper.fromTile({ x: tileX + 1, y: tileY }, TILES_ZOOM),
                southWest: SpatialHelper.fromTile({ x: tileX, y: tileY + 1 }, TILES_ZOOM)
            });
        } catch (ex) {
            this.loggingService.warning(`[Offline Tile Names] Failed to get the regions of tile ${tileKey}: ${(ex as Error).message}`);
            return;
        }
        const name = this.getRegionName(regions, SpatialHelper.fromTile({ x: tileX + 0.5, y: tileY + 0.5 }, TILES_ZOOM));
        const tileNames = this.store.selectSnapshot((s: ApplicationState) => s.offlineState.tileNames);
        if (name != null && tileNames[tileKey] == null) {
            this.store.dispatch(new SetTileNameAction(tileKey, OfflineTileNamesService.toUniqueName(name, Object.values(tileNames))));
        }
    }

    /**
     * The smallest region whose box has the center in it, or the closest one to a center that is out at
     * sea. Only the box of a region is known, so a region next to the right one is picked now and then,
     * which is good enough for a name the user can change.
     */
    private getRegionName(regions: AdminRegion[], center: LatLngAltTime): string | null {
        const closest = regions
            .map(region => ({ region, distance: OfflineTileNamesService.getDistanceFromBounds(center, region.bounds) }))
            .sort((a, b) => a.distance - b.distance ||
                OfflineTileNamesService.getArea(a.region.bounds) - OfflineTileNamesService.getArea(b.region.bounds))[0];
        if (closest == null) {
            return null;
        }
        const name = this.getLocalName(closest.region.tags);
        return closest.distance === 0 ? name : this.resources.nearPlace.replace("{{place}}", name);
    }

    /** The distance in degrees from a point to a box, zero when the point is in it */
    private static getDistanceFromBounds(point: LatLngAltTime, bounds: Bounds): number {
        const latDistance = Math.max(bounds.southWest.lat - point.lat, 0, point.lat - bounds.northEast.lat);
        const lngDistance = Math.max(bounds.southWest.lng - point.lng, 0, point.lng - bounds.northEast.lng);
        return Math.hypot(latDistance, lngDistance);
    }

    private static getArea(bounds: Bounds): number {
        return (bounds.northEast.lat - bounds.southWest.lat) * (bounds.northEast.lng - bounds.southWest.lng);
    }

    /**
     * Numbers a name another tile already has, which tiles of the same region get, so that the list
     * never shows two tiles the user can not tell apart.
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
}
