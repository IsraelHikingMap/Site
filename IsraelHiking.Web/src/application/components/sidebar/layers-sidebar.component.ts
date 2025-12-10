import { Component, inject, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { CdkDragDrop, moveItemInArray, CdkDropList, CdkDrag } from "@angular/cdk/drag-drop";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { NgClass, AsyncPipe, DatePipe } from "@angular/common";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { MatTooltip } from "@angular/material/tooltip";
import { Angulartics2OnModule } from "angulartics2";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { CategoriesGroupComponent } from "./categories-group.component";
import { BaseLayerAddDialogComponent } from "../dialogs/layers/base-layer-add-dialog.component";
import { BaseLayerEditDialogComponent } from "../dialogs/layers/base-layer-edit-dialog.component";
import { OverlayAddDialogComponent } from "../dialogs/layers/overlay-add-dialog.component";
import { OverlayEditDialogComponent } from "../dialogs/layers/overlay-edit-dialog-component";
import { RouteAddDialogComponent } from "../dialogs/routes/route-add-dialog.component";
import { RouteEditDialogComponent } from "../dialogs/routes/route-edit-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { LayersService } from "../../services/layers.service";
import { SidebarService } from "../../services/sidebar.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import { RunningContextService } from "../../services/running-context.service";
import { ToastService } from "../../services/toast.service";
import { PurchaseService } from "../../services/purchase.service";
import { OfflineFilesDownloadService } from "../../services/offline-files-download.service";
import { ExpandGroupAction, CollapseGroupAction } from "../../reducers/layers.reducer";
import { ChangeRouteStateAction, BulkReplaceRoutesAction, ToggleAllRoutesAction } from "../../reducers/routes.reducer";
import { SetSelectedRouteAction } from "../../reducers/route-editing.reducer";
import { CATEGORIES_GROUPS } from "../../reducers/initial-state";
import type { ApplicationState, RouteData, EditableLayer, Overlay, CategoriesGroup } from "../../models";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatButton, Angulartics2OnModule, MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, NgClass, MatTooltip, CategoriesGroupComponent, CdkDropList, CdkDrag, AsyncPipe, DatePipe]
})
export class LayersSidebarComponent {

    public baseLayers$: Observable<Immutable<EditableLayer[]>>;
    public overlays$: Observable<Immutable<Overlay[]>>;
    public categoriesGroups = CATEGORIES_GROUPS;
    public routes$: Observable<Immutable<RouteData[]>>;
    public lastModified$: Observable<Date>;

    public manageSubscriptions: string;

    public readonly resources = inject(ResourcesService);

    private readonly dialog = inject(MatDialog);
    private readonly purchaseService = inject(PurchaseService);
    private readonly layersService = inject(LayersService);
    private readonly selectedRouteService = inject(SelectedRouteService);
    private readonly sidebarService = inject(SidebarService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly toastService = inject(ToastService);
    private readonly offlineFilesDownloadService = inject(OfflineFilesDownloadService);
    private readonly store = inject(Store);

    constructor() {
        this.manageSubscriptions = this.runningContextService.isIos
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";
        this.lastModified$ = this.store.select((state: ApplicationState) => state.offlineState.lastModifiedDate);
        this.baseLayers$ = this.store.select((state: ApplicationState) => state.layersState.baseLayers);
        this.overlays$ = this.store.select((state: ApplicationState) => state.layersState.overlays);
        this.routes$ = this.store.select((state: ApplicationState) => state.routes.present);
    }

    public close() {
        this.sidebarService.hide();
    }

    public addBaseLayer(event: Event) {
        event.stopPropagation();
        this.dialog.open(BaseLayerAddDialogComponent, { width: "480px" });
    }

    public editBaseLayer(e: Event, layer: Immutable<EditableLayer>) {
        e.stopPropagation();
        const dialogRef = this.dialog.open(BaseLayerEditDialogComponent, { width: "480px" });
        dialogRef.componentInstance.setBaseLayer(layer);
    }

    public expand(groupName: string) {
        this.store.dispatch(new ExpandGroupAction(groupName));
    }

    public collapse(groupName: string) {
        this.store.dispatch(new CollapseGroupAction(groupName));
    }

    public getExpandState(groupName: string): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.layersState).expanded.find(l => l === groupName) != null;
    }

    public addOverlay(event: Event) {
        event.stopPropagation();
        this.dialog.open(OverlayAddDialogComponent);
    }

    public editOverlay(e: Event, layer: Immutable<Overlay>) {
        e.stopPropagation();
        const dialogRef = this.dialog.open(OverlayEditDialogComponent, { width: "480px" });
        dialogRef.componentInstance.setOverlay(layer);
    }

    public addRoute(event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteAddDialogComponent, { width: "480px" });
    }

    public editRoute(routeData: Immutable<RouteData>, event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteEditDialogComponent, {
            width: "480px",
            data: {
                ...routeData
            }
        });
    }

    public isBaseLayerSelected(baseLayer: EditableLayer): boolean {
        return this.layersService.isBaseLayerSelected(baseLayer);
    }

    public selectBaseLayer(baseLayer: EditableLayer) {
        this.layersService.selectBaseLayer(baseLayer.key);
    }

    public toggleVisibility(overlay: Overlay) {
        this.layersService.toggleOverlay(overlay);
    }

    public isAllOverlaysHidden(): boolean {
        return this.layersService.isAllOverlaysHidden();
    }

    public hideAllOverlays(event: Event) {
        event.stopPropagation();
        if (this.isAllOverlaysHidden()) {
            return;
        }
        this.layersService.hideAllOverlays();
    }

    public showOfflineButton(layer: EditableLayer) {
        const offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return layer.isOfflineAvailable &&
            this.runningContextService.isCapacitor &&
            (offlineState.lastModifiedDate != null ||
                offlineState.isOfflineAvailable);
    }

    public isOfflineDownloadAvailable() {
        return this.runningContextService.isCapacitor &&
            this.store.selectSnapshot((s: ApplicationState) => s.offlineState).isOfflineAvailable;
    }

    public isPurchaseAvailable() {
        return this.purchaseService.isPurchaseAvailable();
    }

    public isRenewAvailable() {
        return this.purchaseService.isRenewAvailable();
    }

    public orderOfflineMaps() {
        const userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
        this.purchaseService.order();
    }

    public async downloadOfflineMaps() {
        const userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }

        this.offlineFilesDownloadService.downloadOfflineMaps();
    }

    public toggleOffline(event: Event, layer: EditableLayer, isOverlay: boolean) {
        event.stopPropagation();
        if (this.store.selectSnapshot((s: ApplicationState) => s.offlineState).lastModifiedDate == null && !layer.isOfflineOn) {
            this.toastService.warning(this.resources.noOfflineFilesPleaseDownload);
            return;
        }
        this.layersService.toggleOffline(layer, isOverlay);
    }

    public toggleRoute(routeData: Immutable<RouteData>) {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && routeData.id === selectedRoute.id && routeData.state !== "Hidden") {
            this.store.dispatch(new SetSelectedRouteAction(null));
            this.store.dispatch(new ChangeRouteStateAction(routeData.id, "Hidden"));
            return;
        }
        const newRouteState = selectedRoute != null && selectedRoute.state !== "Hidden" ? selectedRoute.state : "ReadOnly";
        this.store.dispatch(new ChangeRouteStateAction(routeData.id, newRouteState));
        this.selectedRouteService.setSelectedRoute(routeData.id);
    }

    public toggleAllRoutes(event: Event) {
        event.stopPropagation();
        this.store.dispatch(new ToggleAllRoutesAction());
        if (this.isAllRoutesHidden()) {
            this.store.dispatch(new SetSelectedRouteAction(null));
        }
    }

    public isAllRoutesHidden(): boolean {
        return this.store.selectSnapshot((s: ApplicationState) => s.routes).present.find(r => r.state !== "Hidden") == null;
    }

    public isRouteVisible(routeData: Immutable<RouteData>): boolean {
        return routeData.state !== "Hidden";
    }

    public isRouteSelected(routeData: Immutable<RouteData>): boolean {
        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === routeData.id;
    }

    public isRouteInEditMode(routeData: Immutable<RouteData>): boolean {
        return routeData.state === "Route" || routeData.state === "Poi";
    }

    public isShowActive(routeData: Immutable<RouteData>): boolean {
        return this.isRouteSelected(routeData) && this.store.selectSnapshot((s: ApplicationState) => s.routes).present.length > 1;
    }

    public dropRoute(event: CdkDragDrop<RouteData[]>) {
        const currentRoutes = [...this.store.selectSnapshot((s: ApplicationState) => s.routes).present] as RouteData[];
        moveItemInArray(currentRoutes, event.previousIndex, event.currentIndex);
        this.store.dispatch(new BulkReplaceRoutesAction(currentRoutes));
    }

    public trackByGroupType(_: number, group: CategoriesGroup) {
        return group.type;
    }
}
