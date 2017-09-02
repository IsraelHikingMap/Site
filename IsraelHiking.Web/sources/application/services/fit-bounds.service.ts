import { Injectable } from "@angular/core";
import * as L from "leaflet";

import { MapService } from "./map.service";
import { SidebarService } from "./sidebar.service";

@Injectable()
export class FitBoundsService {

    constructor(private mapService: MapService,
        private sidebarService: SidebarService) { }

    public fitBounds(bounds: L.LatLngBounds, options: L.FitBoundsOptions = {}) {
        options.paddingTopLeft = this.sidebarService.isVisible && this.mapService.map.getContainer().clientWidth >= 768
            ? L.point(400, 50)
            : L.point(50, 50);

        options.paddingBottomRight = L.point(50, 50);
        this.mapService.map.fitBounds(bounds, options);
    }
}