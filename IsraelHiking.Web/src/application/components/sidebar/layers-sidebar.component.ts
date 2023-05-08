import { Component, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { CdkDragDrop, moveItemInArray } from "@angular/cdk/drag-drop";
import { Observable } from "rxjs";
import { Store, Select } from "@ngxs/store";

import { BaseMapComponent } from "../base-map.component";
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
import type { ApplicationState, RouteData, EditableLayer, Overlay, CategoriesGroup } from "../../models/models";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class LayersSidebarComponent extends BaseMapComponent {

    @Select((state: ApplicationState) => state.layersState.baseLayers)
    public baseLayers: Observable<EditableLayer[]>;

    @Select((state: ApplicationState) => state.layersState.overlays)
    public overlays: Observable<Overlay[]>;

    @Select((state: ApplicationState) => state.layersState.categoriesGroups)
    public categoriesGroups: Observable<CategoriesGroup>;

    @Select((state: ApplicationState) => state.routes.present)
    public routes: Observable<RouteData[]>;

    @Select((state: ApplicationState) => state.offlineState.lastModifiedDate)
    public lastModified: Observable<Date>;

    public manageSubscriptions: string;

    constructor(resources: ResourcesService,
                private readonly dialog: MatDialog,
                private readonly purchaseService: PurchaseService,
                private readonly layersService: LayersService,
                private readonly selectedRouteService: SelectedRouteService,
                private readonly sidebarService: SidebarService,
                private readonly runningContextService: RunningContextService,
                private readonly toastService: ToastService,
                private readonly offlineFilesDownloadService: OfflineFilesDownloadService,
                private readonly store: Store) {
        super(resources);
        this.manageSubscriptions = this.runningContextService.isIos
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";
    }

    public closeSidebar() {
        this.sidebarService.hide();
    }

    public addBaseLayer(event: Event) {
        event.stopPropagation();
        this.dialog.open(BaseLayerAddDialogComponent);
    }

    public editBaseLayer(e: Event, layer: EditableLayer) {
        e.stopPropagation();
        let dialogRef = this.dialog.open(BaseLayerEditDialogComponent);
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

    public editOverlay(e: Event, layer: Overlay) {
        e.stopPropagation();
        let dialogRef = this.dialog.open(OverlayEditDialogComponent);
        dialogRef.componentInstance.setOverlay(layer);
    }

    public addRoute(event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteAddDialogComponent);
    }

    public editRoute(routeData: RouteData, event: Event) {
        event.stopPropagation();
        this.dialog.open(RouteEditDialogComponent, {
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
        let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
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
        let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isOfflineAvailable &&
            offlineState.lastModifiedDate == null;
    }

    public isRenewAvailable() {
        let offlineState = this.store.selectSnapshot((s: ApplicationState) => s.offlineState);
        return this.runningContextService.isCapacitor &&
            !offlineState.isOfflineAvailable &&
            offlineState.lastModifiedDate != null;
    }

    public orderOfflineMaps() {
        let userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }
        this.purchaseService.order();
    }

    public async downloadOfflineMaps() {
        let userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
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

    public toggleRoute(routeData: RouteData) {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute != null && routeData.id === selectedRoute.id && routeData.state !== "Hidden") {
            this.store.dispatch(new SetSelectedRouteAction(null));
            this.store.dispatch(new ChangeRouteStateAction(routeData.id, "Hidden"));
            return;
        }
        let newRouteState = selectedRoute != null && selectedRoute.state !== "Hidden" ? selectedRoute.state : "ReadOnly";
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

    public isRouteVisible(routeData: RouteData): boolean {
        return routeData.state !== "Hidden";
    }

    public isRouteSelected(routeData: RouteData): boolean {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        return selectedRoute != null && selectedRoute.id === routeData.id;
    }

    public isRouteInEditMode(routeData: RouteData): boolean {
        return routeData.state === "Route" || routeData.state === "Poi";
    }

    public isShowActive(routeData: RouteData): boolean {
        return this.isRouteSelected(routeData) && this.store.selectSnapshot((s: ApplicationState) => s.routes).present.length > 1;
    }

    public dropRoute(event: CdkDragDrop<RouteData[]>) {
        let currentRoutes = [...this.store.selectSnapshot((s: ApplicationState) => s.routes).present];
        moveItemInArray(currentRoutes, event.previousIndex, event.currentIndex);
        this.store.dispatch(new BulkReplaceRoutesAction(currentRoutes));
    }

    public trackByGroupType(_: number, group: CategoriesGroup) {
        return group.type;
    }
}
