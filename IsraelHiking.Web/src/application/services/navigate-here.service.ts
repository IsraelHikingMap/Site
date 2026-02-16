import { inject, Injectable } from "@angular/core";
import { Store } from "@ngxs/store";

import { ResourcesService } from "./resources.service";
import { GeoLocationService } from "./geo-location.service";
import { SelectedRouteService } from "./selected-route.service";
import { ToastService } from "./toast.service";
import { RoutingProvider } from "./routing.provider";
import { GpxDataContainerConverterService } from "./gpx-data-container-converter.service";
import { RoutesFactory } from "./routes.factory";
import { AddRouteAction } from "../reducers/routes.reducer";
import type { ApplicationState, LatLngAltTime } from "../models";

@Injectable()
export class NavigateHereService {

    private readonly resources = inject(ResourcesService);
    private readonly toastService = inject(ToastService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly routingProvider = inject(RoutingProvider);
    private readonly routesFactory = inject(RoutesFactory);
    private readonly store = inject(Store);

    public async addNavigationSegment(latlng: LatLngAltTime, title?: string) {
        const currentPosition = this.store.selectSnapshot((s: ApplicationState) => s.gpsState).currentPosition;
        if (currentPosition == null) {
            this.toastService.warning(this.resources.unableToFindYourLocation);
            return;
        }
        const routingType = this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
        const currentLocation = GeoLocationService.positionToLatLngTime(currentPosition);
        const latlngs = await this.routingProvider.getRoute(currentLocation, latlng, routingType);
        let name = this.resources.route + (title ? " " + title : "");
        if (!this.selectedRouteService.isNameAvailable(name)) {
            name = this.selectedRouteService.createRouteName(name);
        }
        const data = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
        data.segments = GpxDataContainerConverterService.getSegmentsFromLatlngs(latlngs, routingType);
        this.store.dispatch(new AddRouteAction(data));

        this.selectedRouteService.setSelectedRoute(data.id);
    }
}
