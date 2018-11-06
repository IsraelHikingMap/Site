import { Injectable } from "@angular/core";

import { SidebarService } from "./sidebar.service";
import { IBounds, LatLngAlt } from "../models/models";
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

    public fitBounds(bounds: IBounds) {
        let padding = [50, 50, 50, 50];
        if (this.sidebarService.isVisible && window.innerWidth >= 768) {
            padding = [50, -400, 50, 50];
        }
        this.mapService.map.getView().fit(SpatialService.boundsToViewExtent(bounds),
            {
                duration: 1000,
                maxZoom: Math.max(this.mapService.map.getView().getZoom(), 16),
                padding: padding
            });

    }

    public flyTo(latLng: LatLngAlt, zoom?: number) {
        this.mapService.map.getView().animate({
            center: SpatialService.toViewCoordinate(latLng),
            zoom: zoom
        });
    }
}