import { Component, HostListener, inject } from "@angular/core";
import { NgIf, NgClass, NgStyle, AsyncPipe } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { Angulartics2OnModule } from "angulartics2";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";

import { ResourcesService } from "../services/resources.service";
import { SelectedRouteService } from "../services/selected-route.service";
import { ToastService } from "../services/toast.service";
import {
    ReplaceSegmentsAction,
    ClearPoisAction,
    ClearPoisAndRouteAction,
    DeleteAllRoutesAction,
    ClearHistoryAction,
    RedoAction,
    UndoAction,
    RestoreHistoryAction
} from "../reducers/routes.reducer";
import { SetRoutingTypeAction, SetSelectedRouteAction } from "../reducers/route-editing.reducer";
import { SetShareUrlAction } from "../reducers/in-memory.reducer";
import type { RoutingType, ApplicationState, RouteData } from "../models/models";

@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html",
    imports: [NgIf, Dir, MatButton, Angulartics2OnModule, NgClass, NgStyle, MatTooltip, MatMenu, MatMenuItem, MatMenuTrigger, AsyncPipe]
})
export class DrawingComponent {

    public undoQueueLength$: Observable<number>;

    public readonly resources = inject(ResourcesService);

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    constructor() {
        this.undoQueueLength$ = this.store.select((state: ApplicationState) => state.routes.past.length);
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
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.store.dispatch(new ReplaceSegmentsAction(selectedRoute.id, []));
    }

    public clearPois() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.store.dispatch(new ClearPoisAction(selectedRoute.id));
    }

    public clearBoth() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        this.store.dispatch(new ClearPoisAndRouteAction(selectedRoute.id));
    }

    public isPoiEditActive() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute && selectedRoute.state === "Poi";
    }

    public isRouteEditActive() {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.state === "Route";
    }

    public isEditActive() {
        return this.isPoiEditActive() || this.isRouteEditActive();
    }

    public toggleEditRoute() {
        const selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
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
        const selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
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
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return "black";
        }
        return selectedRoute.color;
    }

    public deleteAllRoutes() {
        const history = this.store.selectSnapshot((s: ApplicationState) => s.routes.past);
        this.store.dispatch(new SetSelectedRouteAction(null));
        this.store.dispatch(new DeleteAllRoutesAction());
        this.store.dispatch(new SetShareUrlAction(null));
        this.store.dispatch(new ClearHistoryAction());
        this.toastService.undo(this.resources.routesDeleted, () => {
            this.store.dispatch(new RestoreHistoryAction(history as RouteData[][]));
            this.undo();    
        });
    }

    public canDeleteAllRoutes() {
        return this.store.selectSnapshot((s: ApplicationState) => s.routes).present.length > 0;
    }
}
