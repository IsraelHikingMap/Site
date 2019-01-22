import { Component, HostListener } from "@angular/core";
import { NgRedux, select } from "@angular-redux/store";
import { Observable } from "rxjs";
import { ActionCreators } from "redux-undo";

import { ResourcesService } from "../services/resources.service";
import { BaseMapComponent } from "./base-map.component";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { ChangeEditStateAction, ReplaceSegmentsAction, ClearPoisAction, ClearPoisAndRouteAction } from "../reducres/routes.reducer";
import { SetRouteEditingStateAction } from "../reducres/route-editing-state.reducer";
import { RoutingType, ApplicationState } from "../models/models";

@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html"
})
export class DrawingComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.routes.past.length)
    public undoQueueLength: Observable<number>;

    constructor(resources: ResourcesService,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    @HostListener("window:keydown", ["$event"])
    public onDrawingShortcutKeys($event: KeyboardEvent) {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return;
        }
        if ($event.ctrlKey && $event.key.toLowerCase() === "z") {
            this.undo();
        } else if ($event.key === "Escape") {
            if (this.isPoiEditActive()) {
                this.toggleEditPoi();
            }
            if (this.isRouteEditActive()) {
                this.toggleEditRoute();
            }
        }
    }

    public clearRoute() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.ngRedux.dispatch(new ReplaceSegmentsAction({
            routeId: selectedRoute.id,
            segmentsData: []
        }));
    }

    public clearPois() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.ngRedux.dispatch(new ClearPoisAction({
            routeId: selectedRoute.id
        }));
    }

    public clearBoth() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.ngRedux.dispatch(new ClearPoisAndRouteAction({
            routeId: selectedRoute.id
        }));
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
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return recordingRoute != null && selectedRoute != null &&
            recordingRoute.id === selectedRoute.id;
    }

    public isRecording() {
        return this.selectedRouteService.getRecordingRoute() != null;
    }

    public toggleEditRoute() {
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

    public toggleEditPoi() {
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

    public setRouting(routingType: RoutingType) {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return;
        }
        this.ngRedux.dispatch(new SetRouteEditingStateAction({ routingType: routingType }));
    }

    public undo = () => {
        this.ngRedux.dispatch(ActionCreators.undo());
    }

    public getRoutingType = (): RoutingType => {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return "None";
        }
        return this.ngRedux.getState().routeEditingState.routingType;
    }

    public getRouteColor = (): string => {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return "black";
        }
        return selectedRoute.color;
    }
}