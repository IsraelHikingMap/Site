import { Injectable } from "@angular/core";
import { MapService } from "./MapService";
import { SidebarService } from "./SidebarService";

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