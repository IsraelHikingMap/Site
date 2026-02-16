import { Component, inject, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Dir } from "@angular/cdk/bidi";
import { MatButton } from "@angular/material/button";
import { NgClass, AsyncPipe } from "@angular/common";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { MatTooltip } from "@angular/material/tooltip";
import { Observable } from "rxjs";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { CategoriesGroupComponent } from "./categories-group.component";
import { LayerPropertiesDialogComponent } from "../../dialogs/layer-properties-dialog.component";
import { OfflineManagementDialogComponent } from "../../dialogs/offline-management-dialog.component";
import { LegendDialogComponent } from "../../dialogs/legend-dialog.component";
import { Angulartics2OnModule } from "../../../directives/gtag.directive";
import { ResourcesService } from "../../../services/resources.service";
import { LayersService } from "../../../services/layers.service";
import { SidebarService } from "../../../services/sidebar.service";
import { RunningContextService } from "../../../services/running-context.service";
import { ToastService } from "../../../services/toast.service";
import { PurchaseService } from "../../../services/purchase.service";

import { ExpandGroupAction, CollapseGroupAction } from "../../../reducers/layers.reducer";
import { DEFAULT_BASE_LAYERS, CATEGORIES_GROUPS, DEFAULT_OVERLAYS } from "../../../reducers/initial-state";
import type { ApplicationState, EditableLayer, CategoriesGroup } from "../../../models";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatButton, Angulartics2OnModule, MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, NgClass, MatTooltip, CategoriesGroupComponent, AsyncPipe]
})
export class LayersSidebarComponent {

    public readonly defaultBaseLayers = DEFAULT_BASE_LAYERS;
    public readonly defaultOverlays = DEFAULT_OVERLAYS;
    public baseLayers$: Observable<Immutable<EditableLayer[]>>;
    public overlays$: Observable<Immutable<EditableLayer[]>>;
    public categoriesGroups = CATEGORIES_GROUPS;

    public manageSubscriptions: string;

    public readonly resources = inject(ResourcesService);

    private readonly dialog = inject(MatDialog);
    private readonly purchaseService = inject(PurchaseService);
    private readonly layersService = inject(LayersService);

    private readonly sidebarService = inject(SidebarService);
    private readonly runningContextService = inject(RunningContextService);
    private readonly toastService = inject(ToastService);

    private readonly store = inject(Store);

    constructor() {
        this.manageSubscriptions = this.runningContextService.isIos
            ? "https://apps.apple.com/account/subscriptions"
            : "https://play.google.com/store/account/subscriptions";
        this.baseLayers$ = this.store.select((state: ApplicationState) => state.layersState.baseLayers);
        this.overlays$ = this.store.select((state: ApplicationState) => state.layersState.overlays);
    }

    public close() {
        this.sidebarService.hide();
    }

    public addBaseLayer(event: Event) {
        event.stopPropagation();
        LayerPropertiesDialogComponent.openDialog(this.dialog, null, "add-baseLayer");
    }

    public editBaseLayer(e: Event, layer: Immutable<EditableLayer>) {
        e.stopPropagation();
        LayerPropertiesDialogComponent.openDialog(this.dialog, layer, "edit-baseLayer");
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
        LayerPropertiesDialogComponent.openDialog(this.dialog, null, "add-overlay");
    }

    public editOverlay(e: Event, layer: Immutable<EditableLayer>) {
        e.stopPropagation();
        LayerPropertiesDialogComponent.openDialog(this.dialog, layer, "edit-overlay");
    }

    public isBaseLayerSelected(baseLayer: EditableLayer): boolean {
        return this.layersService.isBaseLayerSelected(baseLayer);
    }

    public selectBaseLayer(baseLayer: EditableLayer) {
        this.layersService.selectBaseLayer(baseLayer.key);
    }

    public toggleVisibility(overlay: EditableLayer) {
        this.layersService.toggleOverlay(overlay);
    }

    public isOverlayVisible(overlay: EditableLayer): boolean {
        return this.layersService.isOverlayVisible(overlay);
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

    public isOfflineDownloadAvailable() {
        return this.runningContextService.isCapacitor &&
            this.store.selectSnapshot((s: ApplicationState) => s.offlineState).isSubscribed;
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
        this.purchaseService.showPaywall();
    }

    public async downloadOfflineMaps() {
        const userInfo = this.store.selectSnapshot((s: ApplicationState) => s.userState).userInfo;
        if (userInfo == null || !userInfo.id) {
            this.toastService.warning(this.resources.loginRequired);
            return;
        }

        OfflineManagementDialogComponent.openDialog(this.dialog);
    }

    public trackByGroupType(_: number, group: CategoriesGroup) {
        return group.type;
    }

    public openLegend(layer: Immutable<EditableLayer>) {
        this.dialog.open<LegendDialogComponent, string>(LegendDialogComponent, { width: "480px", data: layer.key });
    }
}
