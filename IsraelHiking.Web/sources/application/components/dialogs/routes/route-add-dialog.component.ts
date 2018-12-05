import { Component, ViewEncapsulation } from "@angular/core";
import { NgRedux } from "@angular-redux/store";

import { ResourcesService } from "../../../services/resources.service";
import { ToastService } from "../../../services/toast.service";
import { RouteLayerFactory } from "../../../services/layers/routelayers/route-layer.factory";
import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { SelectedRouteService } from "../../../services/layers/routelayers/selected-route.service";
import { ApplicationState } from "../../../models/models";
import { AddRouteAction } from "../../../reducres/routes.reducer";
import { SetSelectedRouteAction } from "../../../reducres/route-editing-state.reducer";

@Component({
    selector: "route-add-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
})
export class RouteAddDialogComponent extends RouteBaseDialogComponent {
    constructor(resources: ResourcesService,
        selectedRouteService: SelectedRouteService,
        routeLayerFactory: RouteLayerFactory,
        toastService: ToastService,
        ngRedux: NgRedux<ApplicationState>,
    ) {
        super(resources, selectedRouteService, routeLayerFactory, toastService, ngRedux);
        this.routeData = routeLayerFactory.createRouteData(selectedRouteService.createRouteName());
        this.isNew = true;
        this.title = this.resources.addRoute;
    }

    protected saveImplementation() {
        this.ngRedux.dispatch(new AddRouteAction({
            routeData: this.routeData
        }));
        this.ngRedux.dispatch(new SetSelectedRouteAction({
            routeId: this.routeData.id
        }));
    }
}
