import { Component, HostListener } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { ActionCreators } from "redux-undo";
import { ESCAPE } from "@angular/cdk/keycodes";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { RoutingType, ApplicationState, RouteData } from "../models/models";
import { ChangeEditStateAction } from "../reducres/routes.reducer";
import { SetRouteEditingStateAction } from "../reducres/route-editing-state.reducer";

@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html"
})
export class DrawingComponent extends BaseMapComponent {

    private routingType: RoutingType;

    @select((state: ApplicationState) => state.routeEditingState.routingType)
    private routingType$: Observable<RoutingType>;

    @select((state: ApplicationState) => state.routes.past)
    public undoQueueLength: Observable<number>;

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);

        this.routingType = "None";
        this.routingType$.subscribe((routingType) => {
            this.routingType = routingType;
        });
    }

    @HostListener("window:keydown", ["$event"])
    public onDrawingShortcutKeys($event: KeyboardEvent) {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return;
        }
        if ($event.ctrlKey && String.fromCharCode($event.which).toLowerCase() === "z") {
            this.undo($event);
        } else if ($event.keyCode === ESCAPE) {
            if (this.isPoiEditActive()) {
                this.toggleEditPoi($event);
            }
            if (this.isRouteEditActive()) {
                this.toggleEditRoute($event);
            }
        }
    }

    public clearRoute() {
        // HM TODO: clear.
        throw new Error("Not implemented!");
    }

    public clearPois() {
        // HM TODO: clear.
        throw new Error("Not implemented!");
    }

    public clearBoth() {
        // HM TODO: clear.
        throw new Error("Not implemented!");
    }

    public isPoiEditActive() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute && selectedRoute.state === "Poi";
    }

    public isRouteEditActive() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.state === "Route";
    }

    public isEditActive() {
        return this.isPoiEditActive() || this.isRouteEditActive();
    }

    public isRouteEditDisabled() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null &&
            selectedRoute.isRecording;
    }

    public toggleEditRoute(e: Event) {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        switch (selectedRoute.state) {
            case "Route":
                this.ngRedux.dispatch(new ChangeEditStateAction({ routeId: selectedRoute.id, state: "ReadOnly" }));
                break;
            default:
                this.ngRedux.dispatch(new ChangeEditStateAction({ routeId: selectedRoute.id, state: "Route" }));
                break;
        }
    }

    public toggleEditPoi(e: Event) {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        switch (selectedRoute.state) {
        case "Poi":
            this.ngRedux.dispatch(new ChangeEditStateAction({ routeId: selectedRoute.id, state: "ReadOnly" }));
            break;
        default:
            this.ngRedux.dispatch(new ChangeEditStateAction({ routeId: selectedRoute.id, state: "Poi" }));
            break;
        }
    }

    public setRouting(routingType: RoutingType, e: Event) {
        this.suppressEvents(e);
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return;
        }
        this.ngRedux.dispatch(new SetRouteEditingStateAction({ routingType: routingType }));
    }

    public undo = (e: Event) => {
        this.ngRedux.dispatch(ActionCreators.undo());
    }

    public getRoutingType = (): RoutingType => {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return "None";
        }
        return this.routingType;
    }

    public getRouteColor = (): string => {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return "black";
        }
        return selectedRoute.color;
    }
}