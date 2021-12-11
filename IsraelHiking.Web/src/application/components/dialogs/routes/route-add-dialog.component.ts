import { Component, ViewEncapsulation } from "@angular/core";
import { NgRedux } from "@angular-redux2/store";

import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/layers/routelayers/routes.factory";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { AddRouteAction } from "../../../reducers/routes.reducer";
import type { ApplicationState } from "../../../models/models";

@Component({
    selector: "route-add-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteAddDialogComponent extends RouteBaseDialogComponent {
    constructor(resources: ResourcesService,
                selectedRouteService: SelectedRouteService,
                routesFactory: RoutesFactory,
                toastService: ToastService,
                ngRedux: NgRedux<ApplicationState>,
    ) {
        super(resources, selectedRouteService, routesFactory, toastService, ngRedux);
        this.routeData = routesFactory.createRouteData(selectedRouteService.createRouteName(),
            selectedRouteService.getLeastUsedColor());
        this.isNew = true;
        this.title = this.resources.addRoute;
    }

    protected saveImplementation() {
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: this.routeData
        }));
        this.selectedRouteService.setSelectedRoute(this.routeData.id);
    }
}
