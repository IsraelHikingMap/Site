import { Component, HostListener } from "@angular/core";
import { Observable } from "rxjs";
import { ActionCreators } from "redux-undo";
import { NgRedux, select } from "@angular-redux2/store";

import { BaseMapComponent } from "./base-map.component";
import { ResourcesService } from "../services/resources.service";
import { SelectedRouteService } from "../services/layers/routelayers/selected-route.service";
import { RecordedRouteService } from "../services/recorded-route.service";
import { ToastService } from "../services/toast.service";
import {
    ChangeEditStateAction,
    ReplaceSegmentsAction,
    ClearPoisAction,
    ClearPoisAndRouteAction,
    DeleteAllRoutesAction
} from "../reducers/routes.reducer";
import { SetRouteEditingStateAction } from "../reducers/route-editing-state.reducer";
import { SetShareUrlAction } from "../reducers/in-memory.reducer";
import type { RoutingType, ApplicationState } from "../models/models";

@Component({
    selector: "drawing",
    templateUrl: "./drawing.component.html"
})
export class DrawingComponent extends BaseMapComponent {

    @select((state: ApplicationState) => state.routes.past.length)
    public undoQueueLength: Observable<number>;

    constructor(resources: ResourcesService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly recordedRouteService: RecordedRouteService,
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

    public isRouteEditDisabled() {
        let recordingRoute = this.selectedRouteService.getRecordingRoute();
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return recordingRoute != null && selectedRoute != null &&
            recordingRoute.id === selectedRoute.id;
    }

    public isRecording() {
        return this.recordedRouteService.isRecording();
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
        this.ngRedux.dispatch(new SetRouteEditingStateAction({ routingType }));
    }

    public undo() {
        this.ngRedux.dispatch(ActionCreators.undo());
        // Undo can change the route editing state but doesn't affect the selected route...
        // HM TODO: should selected route be part of the routes undo object?
        this.selectedRouteService.syncSelectedRouteWithEditingRoute();
    }

    private redo() {
        this.ngRedux.dispatch(ActionCreators.redo());
        // Undo can change the route editing state but doesn't affect the selected route...
        // HM TODO: should selected route be part of the routes undo object?
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
        if (!this.recordedRouteService.isRecording()) {
            this.showDeleteAllRoutesConfirmation();
            return;
        }
        this.toastService.confirm({
            message: this.resources.areYouSureYouWantToStopRecording,
            confirmAction: () => {
                this.recordedRouteService.stopRecording();
                this.showDeleteAllRoutesConfirmation();
            },
            type: "YesNo"
        });
    }

    private showDeleteAllRoutesConfirmation() {
        this.toastService.confirm({
            message: this.resources.areYouSureYouWantToDeleteAllRoutes,
            type: "YesNo",
            confirmAction: () => {
                this.ngRedux.dispatch(new SetShareUrlAction({ shareUrl: null }));
                this.ngRedux.dispatch(new DeleteAllRoutesAction());
            }
        });
    }
}
