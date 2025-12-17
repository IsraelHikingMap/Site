import { Component, ViewEncapsulation } from "@angular/core";
import { Dir } from "@angular/cdk/bidi";
import { MatDialogTitle, MatDialogClose, MatDialogContent, MatDialogActions } from "@angular/material/dialog";
import { MatButton, MatMiniFabButton } from "@angular/material/button";
import { CdkScrollable } from "@angular/cdk/scrolling";
import { MatFormField, MatLabel } from "@angular/material/form-field";
import { MatInput } from "@angular/material/input";
import { FormsModule } from "@angular/forms";
import { NgStyle } from "@angular/common";
import { MatSlider, MatSliderThumb } from "@angular/material/slider";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatTooltip } from "@angular/material/tooltip";

import { RouteBaseDialogComponent } from "./route-base-dialog.component";
import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { AddRouteAction } from "../../../reducers/routes.reducer";

@Component({
    selector: "route-add-dialog",
    templateUrl: "./route-properties-dialog.component.html",
    styleUrls: ["./route-properties-dialog.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatDialogTitle, MatButton, MatDialogClose, CdkScrollable, MatDialogContent, MatFormField, MatLabel, MatInput, FormsModule, MatMiniFabButton, MatSlider, MatSliderThumb, NgStyle, MatDialogActions, MatMenu, MatMenuItem, Angulartics2OnModule, MatMenuTrigger, MatTooltip]
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
