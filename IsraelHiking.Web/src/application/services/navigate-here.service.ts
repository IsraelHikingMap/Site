import { Injectable } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";

import { ResourcesService } from "./resources.service";
import { GeoLocationService } from "./geo-location.service";
import { SelectedRouteService } from "./selected-route.service";
import { ToastService } from "./toast.service";
import { RouterService } from "./router.service";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { RoutesFactory } from "./routes.factory";
import { AddRouteAction } from "../reducers/routes.reducer";
import type { ApplicationState, LatLngAlt, LatLngAltTime } from "../models/models";

@Injectable()
export class NavigateHereService {
    constructor(private readonly resources: ResourcesService,
                private readonly geoLocationService: GeoLocationService,
                private readonly toastService: ToastService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routerService: RouterService,
                private readonly routesFactory: RoutesFactory,
                private readonly ngRedux: NgRedux<ApplicationState>) { }

    public async addNavigationSegment(latlng: LatLngAlt, title: string) {
        let currentPoistion = this.ngRedux.getState().gpsState.currentPoistion;
        if (currentPoistion == null) {
            this.toastService.warning(this.resources.unableToFindYourLocation);
            return;
        }
        let routingType = this.ngRedux.getState().routeEditingState.routingType;
        let currentLocation = this.geoLocationService.positionToLatLngTime(currentPoistion);
        let latlngs = await this.routerService.getRoute(currentLocation, latlng, routingType);
        let name = this.resources.route + (title ? " " + title : "");
        if (!this.selectedRouteService.isNameAvailable(name)) {
            name = this.selectedRouteService.createRouteName(name);
        }
        let data = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
        data.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(latlngs as LatLngAltTime[], routingType);
        this.ngRedux.dispatch(new AddRouteAction({ routeData: data }));

        if (this.selectedRouteService.getSelectedRoute() == null) {
            this.selectedRouteService.setSelectedRoute(data.id);
        }
    }
}
