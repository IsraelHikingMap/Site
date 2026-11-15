import { Component, inject, computed, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatDivider } from "@angular/material/divider";
import { NgClass } from "@angular/common";
import { MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle } from "@angular/material/expansion";
import { MatTooltip } from "@angular/material/tooltip";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { PointsOfInterestCategoriesComponent } from "./points-of-interest-categories.component";
import { LayerTileComponent } from "./layer-tile.component";
import { ManageLayersDialogComponent } from "./manage-layers-dialog.component";
import { MatBadge } from "@angular/material/badge";
import { LegendDialogComponent } from "../../dialogs/legend-dialog.component";
import { AnalyticsDirective } from "../../../directives/analytics.directive";
import { ResourcesService } from "../../../services/resources.service";
import { LayersService } from "../../../services/layers.service";
import { SidebarService } from "../../../services/sidebar.service";

import { ExpandGroupAction, CollapseGroupAction } from "../../../reducers/layers.reducer";
import { DEFAULT_OVERLAYS, HIKING_MAP, MTB_MAP } from "../../../reducers/initial-state";
import type { ApplicationState, EditableLayer } from "../../../models";

@Component({
    selector: "layers-sidebar",
    templateUrl: "./layers-sidebar.component.html",
    styleUrls: ["./layers-sidebar.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, MatButton, MatIconButton, MatDivider, MatBadge, LayerTileComponent, AnalyticsDirective, MatAccordion, MatExpansionPanel, MatExpansionPanelHeader, MatExpansionPanelTitle, NgClass, MatTooltip, PointsOfInterestCategoriesComponent]
})
export class LayersSidebarComponent {

    public readonly resources = inject(ResourcesService);

    private readonly dialog = inject(MatDialog);
    private readonly layersService = inject(LayersService);

    private readonly sidebarService = inject(SidebarService);

    private readonly store = inject(Store);

    private readonly userBaseLayers = this.store.selectSignal((state: ApplicationState) => state.layersState.baseLayers);
    private readonly userOverlays = this.store.selectSignal((state: ApplicationState) => state.layersState.overlays);
    public readonly defaultBaseLayers = this.layersService.defaultBaseLayers;
    public readonly baseLayers = computed(() => this.userBaseLayers().filter(l => this.layersService.isShownInPanel(l, false)));
    public readonly defaultOverlays = DEFAULT_OVERLAYS;
    public readonly overlays = computed(() => this.userOverlays().filter(l => this.layersService.isShownInPanel(l, true)));
    /** How many base maps the panel does not list, so the user can tell some are hidden and not gone. */
    public readonly hiddenBaseLayersCount = computed(() =>
        this.userBaseLayers().length - this.baseLayers().length);
    /** How many overlays the panel does not list, so the user can tell some are hidden and not gone. */
    public readonly hiddenOverlaysCount = computed(() =>
        this.userOverlays().length - this.overlays().length);
    private readonly expanded = this.store.selectSignal((state: ApplicationState) => state.layersState.expanded);

    public close() {
        this.sidebarService.hide();
    }

    public expand(groupName: string) {
        this.store.dispatch(new ExpandGroupAction(groupName));
    }

    public collapse(groupName: string) {
        this.store.dispatch(new CollapseGroupAction(groupName));
    }

    public getExpandState(groupName: string): boolean {
        return this.expanded().find(l => l === groupName) != null;
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

    public getThumbnail(layer: Immutable<EditableLayer>): string {
        return this.layersService.getThumbnail(layer);
    }

    public openManage(isOverlay: boolean) {
        ManageLayersDialogComponent.open(this.dialog, { isOverlay });
    }

    public editLayer(event: Event, layer: Immutable<EditableLayer>, isOverlay: boolean) {
        event.stopPropagation();
        ManageLayersDialogComponent.open(this.dialog, { key: layer.key, isOverlay });
    }

    public hasLegend(layer: Immutable<EditableLayer>): boolean {
        return layer.key === HIKING_MAP || layer.key === MTB_MAP;
    }

    public openLegend(layer: Immutable<EditableLayer>) {
        this.dialog.open<LegendDialogComponent, string>(LegendDialogComponent, { width: "480px", data: layer.key });
    }
}
