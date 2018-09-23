import { Injectable } from "@angular/core";
import * as L from "leaflet";

import { MapService } from "./map.service";
import { SidebarService } from "./sidebar.service";

@Injectable()
export class FitBoundsService {
    public static readonly DEFAULT_MAX_ZOOM = 16;
    public isFlying: boolean;

    constructor(private mapService: MapService,
        private sidebarService: SidebarService) {
        this.isFlying = false;
    }

    public fitBounds(bounds: L.LatLngBounds, options: L.FitBoundsOptions = {}) {
        options.paddingTopLeft = this.sidebarService.isVisible && this.mapService.map.getContainer().clientWidth >= 768
            ? L.point(400, 50)
            : L.point(50, 50);

        options.paddingBottomRight = L.point(50, 50);
        this.isFlying = true;
        this.mapService.map.once("moveend", () => this.isFlying = false);
        this.mapService.map.flyToBounds(bounds, options);
    }
}