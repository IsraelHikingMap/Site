import { Component, ViewEncapsulation } from "@angular/core";

import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { AddRouteAction } from "../../../reducers/routes.reducer";

@Component({
    selector: "route-add-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
    standalone: false
})
export class RouteAddDialogComponent extends RouteBaseDialogComponent {
    constructor() {
        super();
        this.routeData = this.routesFactory.createRouteData(this.selectedRouteService.createRouteName(),
            this.selectedRouteService.getLeastUsedColor());
        this.isNew = true;
        this.title = this.resources.addRoute;
    }

    protected saveImplementation() {
        this.store.dispatch(new AddRouteAction(this.routeData));
        this.selectedRouteService.setSelectedRoute(this.routeData.id);
    }
}
