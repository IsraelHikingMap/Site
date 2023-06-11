import { Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

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
                private readonly toastService: ToastService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly routerService: RouterService,
                private readonly routesFactory: RoutesFactory,
                private readonly store: Store) { }

    public async addNavigationSegment(latlng: LatLngAlt, title: string) {
        const currentPosition = this.store.selectSnapshot((s: ApplicationState) => s.gpsState).currentPosition;
        if (currentPosition == null) {
            this.toastService.warning(this.resources.unableToFindYourLocation);
            return;
        }
        const routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        const currentLocation = GeoLocationService.positionToLatLngTime(currentPosition);
        const latlngs = await this.routerService.getRoute(currentLocation, latlng, routingType);
        let name = this.resources.route + (title ? " " + title : "");
        if (!this.selectedRouteService.isNameAvailable(name)) {
            name = this.selectedRouteService.createRouteName(name);
        }
        const data = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
        data.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(latlngs as LatLngAltTime[], routingType);
        this.store.dispatch(new AddRouteAction(data));

        if (this.selectedRouteService.getSelectedRoute() == null) {
            this.selectedRouteService.setSelectedRoute(data.id);
        }
    }
}
