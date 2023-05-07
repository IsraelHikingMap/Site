import { Component, HostListener } from "@angular/core";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SelectedRouteService } from "../services/selected-route.service";
import { ToastService } from "../services/toast.service";
import { ClearHistoryAction, ClearPoisAction, ClearPoisAndRouteAction, DeleteAllRoutesAction, RedoAction, ReplaceSegmentsAction, RoutesReducer, UndoAction } from "../reducers/routes.reducer";
import { SetRoutingTypeAction, SetSelectedRouteAction } from "../reducers/route-editing.reducer";
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
                private readonly store: Store) {
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
        return this.store.selectSnapshot((s: ApplicationState) => s.uiComponentsState).drawingVisible;
    }

    public clearRoute() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.store.dispatch(new ReplaceSegmentsAction(selectedRoute.id, []));
    }

    public clearPois() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.store.dispatch(new ClearPoisAction(selectedRoute.id));
    }

    public clearBoth() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.store.dispatch(new ClearPoisAndRouteAction(selectedRoute.id));
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
        this.store.dispatch(new SetRoutingTypeAction(routingType));
    }

    public undo() {
        this.store.dispatch(new UndoAction());
        // Undo can change the route editing state but doesn't affect the selected route...
        this.selectedRouteService.syncSelectedRouteWithEditingRoute();
    }

    private redo() {
        this.store.dispatch(new RedoAction());
        // Undo can change the route editing state but doesn't affect the selected route...
        this.selectedRouteService.syncSelectedRouteWithEditingRoute();
    }

    public getRoutingType(): RoutingType {
        if (this.selectedRouteService.getSelectedRoute() == null) {
            return "None";
        }
        return this.store.selectSnapshot((s: ApplicationState) => s.routeEditingState).routingType;
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
                this.store.dispatch(new SetShareUrlAction(null));
                this.store.dispatch(new SetSelectedRouteAction(null));
                this.store.dispatch(new DeleteAllRoutesAction());
                this.store.dispatch(new ClearHistoryAction());
            }
        });
    }

    public canDeleteAllRoutes() {
        return this.store.selectSnapshot((s: ApplicationState) => s.routes).present.length > 0;
    }
}
