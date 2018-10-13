import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { SidebarService } from "./sidebar.service";
import { IBounds, LatLngAlt } from "../models/models";
import { ApplicationState } from "../models/models";
import { LocationActions, SetLocationAction } from "../reducres/location.reducer";

@Injectable()
export class FitBoundsService {
    public static readonly DEFAULT_MAX_ZOOM = 16;
    public isFlying: boolean;

    constructor(private readonly ngRedux: NgRedux<ApplicationState>,
        private readonly sidebarService: SidebarService) {
        this.isFlying = false;
    }

    public fitBounds(bounds: IBounds) {
        // HM TODO: fly to bounds correctly
        // options.paddingTopLeft = this.sidebarService.isVisible && window.innerWidth >= 768
        //    ? L.point(400, 50)
        //    : L.point(50, 50);

        // options.paddingBottomRight = L.point(50, 50);
        this.isFlying = true;
        let centerLat = (bounds.northEast.lat + bounds.southWest.lat) / 2.0;
        let centerLng = (bounds.northEast.lng + bounds.southWest.lng) / 2.0;

        this.ngRedux.dispatch(new SetLocationAction({ latitude: centerLat, longitude: centerLng}));
    }

    public flyTo(latLng: LatLngAlt, zoom: number) {
        this.ngRedux.dispatch(new SetLocationAction({ latitude: latLng.lng, longitude: latLng.lat, zoom: zoom }));
    }
}