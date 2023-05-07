import { Component, ViewEncapsulation } from "@angular/core";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RoutesFactory } from "../../../services/routes.factory";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { SelectedRouteService } from "../../../services/selected-route.service";
import { AddRouteAction } from "../../../reducers/routes.reducer";

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
                store: Store,
    ) {
        super(resources, selectedRouteService, routesFactory, toastService, store);
        this.routeData = routesFactory.createRouteData(selectedRouteService.createRouteName(),
            selectedRouteService.getLeastUsedColor());
        this.isNew = true;
        this.title = this.resources.addRoute;
    }

    protected saveImplementation() {
        this.store.dispatch(new AddRouteAction(this.routeData));
        this.selectedRouteService.setSelectedRoute(this.routeData.id);
    }
}
