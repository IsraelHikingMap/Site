import { Component, HostListener } from "@angular/core";
import { Observable } from "rxjs";
import { ActionCreators } from "redux-undo";
import { NgRedux, Select } from "@angular-redux2/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SelectedRouteService } from "../services/selected-route.service";
import { ToastService } from "../services/toast.service";
import {
    ReplaceSegmentsAction,
    ClearPoisAction,
    ClearPoisAndRouteAction,
    DeleteAllRoutesAction
} from "../reducers/routes.reducer";
import { SetRouteEditingStateAction, SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import { SetShareUrlAction } from "../reducers/in-memory.reducer";
import type { RoutingType, ApplicationState } from "../models/models";

@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html"
})
export class DrawingComponent extends BaseMapComponent {

    @Select((state: ApplicationState) => state.routes.past.length)
    public undoQueueLength: Observable<number>;

    constructor(resources: ResourcesService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly toastService: ToastService,
                private readonly ngRedux: NgRedux<ApplicationState>) {
        super(resources);
    }

    @HostListener("window:keydown", ["$event"])
    public onDrawingShortcutKeys($event: KeyboardEvent) {
        if (($event.ctrlKey && $event.code === "KeyY") ||
            ($event.metaKey && $event.shiftKey && $event.code === "KeyZ")) {
            this.redo();
            return;
        }
        if (($event.ctrlKey || $event.metaKey) && $event.code === "KeyZ") {
            this.undo();
            return;
        }
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return;
        }
        if ($event.key === "Escape") {
            if (this.isPoiEditActive()) {
                this.toggleEditPoi();
            }
            if (this.isRouteEditActive()) {
                this.toggleEditRoute();
            }
        }
    }

    public isShow() {
        return this.ngRedux.getState().uiComponentsState.drawingVisible;
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

    public toggleEditRoute() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        switch (selectedRoute.state) {
            case "Route":
                this.selectedRouteService.changeRouteEditState(selectedRoute.id, "ReadOnly");
                break;
            default:
                this.selectedRouteService.changeRouteEditState(selectedRoute.id, "Route");
                break;
        }
    }

    public toggleEditPoi() {
        let selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        switch (selectedRoute.state) {
            case "Poi":
                this.selectedRouteService.changeRouteEditState(selectedRoute.id, "ReadOnly");
                break;
            default:
                this.selectedRouteService.changeRouteEditState(selectedRoute.id, "Poi");
                break;
        }
    }

    public setRouting(routingType: RoutingType) {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return;
        }
        this.ngRedux.dispatch(new SetRouteEditingStateAction({ routingType }));
    }

    public undo() {
        this.ngRedux.dispatch(ActionCreators.undo());
        // Undo can change the route editing state but doesn't affect the selected route...
        this.selectedRouteService.syncSelectedRouteWithEditingRoute();
    }

    private redo() {
        this.ngRedux.dispatch(ActionCreators.redo());
        // Undo can change the route editing state but doesn't affect the selected route...
        this.selectedRouteService.syncSelectedRouteWithEditingRoute();
    }

    public getRoutingType(): RoutingType {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return "None";
        }
        return this.ngRedux.getState().routeEditingState.routingType;
    }

    public getRouteColor(): string {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return "black";
        }
        return selectedRoute.color;
    }

    public deleteAllRoutes() {
        this.toastService.confirm({
            message: this.resources.areYouSureYouWantToDeleteAllRoutes,
            type: "YesNo",
            confirmAction: () => {
                this.ngRedux.dispatch(new SetShareUrlAction({ shareUrl: null }));
                this.ngRedux.dispatch(new SetSelectedRouteAction({routeId: null}));
                this.ngRedux.dispatch(new DeleteAllRoutesAction());
                this.ngRedux.dispatch(ActionCreators.clearHistory());
            }
        });
    }
}
