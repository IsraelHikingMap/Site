import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

import { SidebarService } from "./sidebar.service";
import { MapService } from "./map.service";
import { SpatialService } from "./spatial.service";
import { SetPannedAction } from "../reducers/in-memory.reducer";
import type { Bounds, LatLngAltTime } from "../models";

@Injectable()
export class FitBoundsService {
    public static readonly DEFAULT_MAX_ZOOM = 16;
    public isFlying = false;

    private readonly sidebarService = inject(SidebarService);
    private readonly mapService = inject(MapService);
    private readonly store = inject(Store);

    public async fitBounds(bounds: Bounds, noPadding = false) {
        await this.mapService.initializationPromise;
        const maxZoom = Math.max(this.mapService.map.getZoom(), 16);
        const mbBounds = SpatialService.boundsToMBBounds(bounds);

        this.store.dispatch(new SetPannedAction(new Date()));
        this.mapService.map.fitBounds(mbBounds, {
            maxZoom,
            padding: this.getPadding(noPadding)
        });
    }

    private getPadding(noPadding = false) {
        let padding = 50;
        if (noPadding) {
            padding = 0;
        }
        if (!this.sidebarService.isSidebarOpen()) {
            return padding;
        }
        if (window.innerWidth >= 550) {
            return { top: 50, left: 400, bottom: 50, right: 50 }
        }
        return { top: 50, left: 50, bottom: window.innerHeight / 2, right: 50 }
    }

    public async flyTo(latLng: LatLngAltTime, zoom: number) {
        await this.mapService.initializationPromise;
        if (SpatialService.getDistance(this.mapService.map.getCenter(), latLng) < 0.0001 &&
            Math.abs(zoom - this.mapService.map.getZoom()) < 0.01) {
            // ignoring flyto for small coordinates change:
            // this happens due to route percision reduce which causes another map move.
            return;
        }
        this.store.dispatch(new SetPannedAction(new Date()));
        this.mapService.map.flyTo({ center: latLng, zoom });
    }

    public async moveTo(center: LatLngAltTime, zoom: number, bearing: number) {
        await this.mapService.initializationPromise;
        this.mapService.map.easeTo({
            bearing,
            center,
            zoom,
            animate: true,
            easing: (x) => x,
            offset: [0, 100]
        });
    }
}
