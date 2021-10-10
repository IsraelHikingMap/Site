import { Injectable } from "@angular/core";

import { ResourcesService } from "./resources.service";
import { GeoLocationService } from "./geo-location.service";
import { SelectedRouteService } from "./layers/routelayers/selected-route.service";
import { ToastService } from "./toast.service";
import { RouterService } from "./router.service";
import { RoutesFactory } from "./layers/routelayers/routes.factory";
import { NgRedux } from "../reducers/infra/ng-redux.module";
import { AddSegmentAction, AddRouteAction, ChangeRoutePropertiesAction } from "../reducers/routes.reducer";
import type { ApplicationState, LatLngAlt } from "../models/models";

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
        let routeSegments = await this.routerService.getRoute(currentLocation, latlng, routingType);
        if (routeSegments.length === 0 || routeSegments[0].latlngs.length < 2) {
            this.toastService.warning(this.resources.routingFailed);
            return;
        }
        let name = this.resources.route + (title ? " " + title : "");
        if (!this.selectedRouteService.isNameAvailable(name)) {
            name = this.selectedRouteService.createRouteName(name);
        }
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && selectedRoute.segments.length === 0) {
            for (let segment of routeSegments) {
                this.ngRedux.dispatch(new AddSegmentAction({ routeId: selectedRoute.id, segmentData: segment }));
            }
            this.ngRedux.dispatch(new ChangeRoutePropertiesAction({
                routeId: selectedRoute.id,
                routeData: {
                    ...selectedRoute,
                    name
                }
            }));
            return;
        }
        let data = this.routesFactory.createRouteData(name, this.selectedRouteService.getLeastUsedColor());
        data.segments = routeSegments;
        this.ngRedux.dispatch(new AddRouteAction({ routeData: data }));

        if (selectedRoute == null) {
            this.selectedRouteService.setSelectedRoute(data.id);
        }
    }
}
