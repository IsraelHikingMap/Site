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
        if (this.sidebarService.isSidebarOpen() && window.innerWidth < 768) {
            this.mapService.map.fitBounds(mbBounds,
                {
                    maxZoom: maxZoom,
                    padding: padding
                });
        } else {
            this.mapService.map.fitBounds(mbBounds,
                {
                    maxZoom: maxZoom,
                    padding: { top: 50, left: 400, bottom: 50, right: 50 }
                });
        }
    }

    public async flyTo(latLng: LatLngAlt, zoom: number) {
        await this.mapService.initializationPromise;
        this.mapService.map.flyTo({ center: latLng, zoom: zoom });
    }
}