import { Component, HostListener, inject } from "@angular/core";
import { NgClass, NgStyle, AsyncPipe } from "@angular/common";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { MatTooltip } from "@angular/material/tooltip";
import { MatMenu, MatMenuItem, MatMenuTrigger } from "@angular/material/menu";
import { MatDialog } from "@angular/material/dialog";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";

import { Angulartics2OnModule } from "../directives/gtag.directive";
import { ResourcesService } from "../services/resources.service";
import { SelectedRouteService } from "../services/selected-route.service";
import { ToastService } from "../services/toast.service";
import { SidebarService } from "../services/sidebar.service";
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
import type { RoutingType, ApplicationState, RouteData } from "../models";
import { ShareDialogComponent, ShareDialogComponentData } from "./dialogs/share-dialog.component";

@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html",
    imports: [Dir, MatButton, Angulartics2OnModule, NgClass, NgStyle, MatTooltip, MatMenu, MatMenuItem, MatMenuTrigger, AsyncPipe]
})
export class DrawingComponent {

    public undoQueueLength$: Observable<number>;

    public readonly resources = inject(ResourcesService);

    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);
    private readonly sidebarService = inject(SidebarService);
    private readonly dialog = inject(MatDialog);

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
                this.checkTrackingAndIssueWarningIfNeeded();
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
                this.checkTrackingAndIssueWarningIfNeeded();
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
        const presentRoutes = this.store.selectSnapshot((s: ApplicationState) => s.routes).present;
        if (presentRoutes.length < 2) {
            const history = structuredClone(this.store.selectSnapshot((s: ApplicationState) => s.routes.past)) as RouteData[][];
            history.push(structuredClone(presentRoutes) as RouteData[]);
            this.deleteAllRoutesInternal();
            this.toastService.undo(this.resources.routesDeleted, () => {
                this.store.dispatch(new RestoreHistoryAction(history));
                this.undo();
            });
        } else {
            this.toastService.confirm({
                message: this.resources.areYouSureYouWantToDeleteAllRoutes
                    .replace("{{count}}", `${presentRoutes.length}`),
                type: "YesNo",
                confirmAction: () => {
                    this.deleteAllRoutesInternal();
                }
            });
        }
    }

    private deleteAllRoutesInternal() {
        this.store.dispatch(new SetSelectedRouteAction(null));
        this.store.dispatch(new DeleteAllRoutesAction());
        this.store.dispatch(new SetShareUrlAction(null));
        this.store.dispatch(new ClearHistoryAction());
    }

    public canDeleteAllRoutes() {
        return this.store.selectSnapshot((s: ApplicationState) => s.routes).present.length > 0;
    }

    public togglePrivateRoutes() {
        this.sidebarService.toggle("private-routes");
    }

    public share() {
        const selectedRoute = this.selectedRouteService.getOrCreateSelectedRoute();
        this.selectedRouteService.changeRouteEditState(selectedRoute.id, "ReadOnly");
        this.dialog.open<ShareDialogComponent, ShareDialogComponentData>(ShareDialogComponent, { width: "480px", data: { mode: "current" } });
    }

    private checkTrackingAndIssueWarningIfNeeded() {
        const inMemeoryState = this.store.selectSnapshot((s: ApplicationState) => s.inMemoryState);
        const tracking = this.store.selectSnapshot((s: ApplicationState) => s.gpsState.tracking);
        if (inMemeoryState.following && tracking === "tracking") {
            this.toastService.warning(this.resources.trackingIsDisabledWhileEditing);
        }
    }
}
