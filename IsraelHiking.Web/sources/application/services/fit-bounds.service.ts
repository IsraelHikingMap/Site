import { Injectable } from "@angular/core";

import { SidebarService } from "./sidebar.service";
import { Bounds, LatLngAlt } from "../models/models";
import { MapService } from "./map.service";
import { SpatialService } from "./spatial.service";

@Injectable()
export class FitBoundsService {
    public static readonly DEFAULT_MAX_ZOOM = 16;
    public isFlying: boolean;

    constructor(private readonly sidebarService: SidebarService,
                private readonly mapService: MapService) {
        this.isFlying = false;
    }

    public async fitBounds(bounds: Bounds, noPadding: boolean = false) {
        await this.mapService.initializationPromise;
        let maxZoom = Math.max(this.mapService.map.getZoom(), 16);
        let mbBounds = SpatialService.boundsToMBBounds(bounds);
        let padding = 50;
        if (noPadding) {
            padding = 0;
        }
        if (this.sidebarService.isSidebarOpen() && window.innerWidth >= 768) {
            this.mapService.map.fitBounds(mbBounds,
                {
                    maxZoom,
                    padding: { top: 50, left: 400, bottom: 50, right: 50 }
                });
        } else {
            this.mapService.map.fitBounds(mbBounds,
                {
                    maxZoom,
                    padding
                });
        }
    }

    public async flyTo(latLng: LatLngAlt, zoom: number) {
        await this.mapService.initializationPromise;
        if (SpatialService.getDistance(this.mapService.map.getCenter(), latLng) < 0.0001 &&
            Math.abs(zoom - this.mapService.map.getZoom()) < 0.01) {
            // ignoring flyto for small coordinates change:
            // this happens due to route percision reduce which causes another map move.
            return;
        }
        this.mapService.map.flyTo({ center: latLng, zoom });
    }

    public async moveTo(center: LatLngAlt, zoom: number, animate: boolean, bearing?: number) {
        await this.mapService.initializationPromise;
        this.mapService.map.easeTo({
            bearing: bearing || this.mapService.map.getBearing(),
            center,
            zoom,
            animate,
            easing: (x) => x,
            offset: [0, 100]
        });
    }
}
