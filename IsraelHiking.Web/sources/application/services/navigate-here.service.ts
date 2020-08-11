import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "./resources.service";
import { GeoLocationService } from "./geo-location.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { ToastService } from "./toast.service";
import { ApplicationState, LatLngAlt } from "../models/models";
import { RouterService } from "./router.service";
import { AddSegmentAction } from "../reducres/routes.reducer";

@Injectable()
export class NavigateHereService {
    constructor(private readonly resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly toastService: ToastService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routerService: RouterService,
                private readonly ngRedux: NgRedux<ApplicationState>) { }

    public async addNavigationSegment(latlng: LatLngAlt) {
        if (this.geoLocationService.currentLocation == null) {
            this.toastService.warning(this.resources.unableToFindYourLocation);
            return;
        }
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        let routeSegments = await this.routerService.getRoute(this.geoLocationService.currentLocation, latlng, routingType);
        if (routeSegments.length === 0 || routeSegments[0].latlngs.length < 2) {
            this.toastService.warning(this.resources.routingFailed);
            return;
        }

        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        if (selectedRoute.segments.length === 0) {
            this.ngRedux.dispatch(new AddSegmentAction({
                routeId: selectedRoute.id,
                segmentData: routeSegments[0]
            }));
        }
        this.ngRedux.dispatch(new AddSegmentAction({
            routeId: selectedRoute.id,
            segmentData: routeSegments[routeSegments.length - 1]
        }));
    }
}
