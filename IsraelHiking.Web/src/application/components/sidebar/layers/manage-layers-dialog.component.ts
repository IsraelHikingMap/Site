import { afterNextRender, Component, inject, Injector, signal } from "@angular/core";
import { CdkCopyToClipboard } from "@angular/cdk/clipboard";
import { Dir } from "@angular/cdk/bidi";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatCheckbox } from "@angular/material/checkbox";
import { MAT_DIALOG_DATA, MatDialog, MatDialogClose, MatDialogContent, MatDialogTitle } from "@angular/material/dialog";
import { MatTooltip } from "@angular/material/tooltip";
import { MatExpansionPanel, MatExpansionPanelContent } from "@angular/material/expansion";
import { Share } from "@capacitor/share";
import { Store } from "@ngxs/store";
import type { Immutable } from "immer";

import { LayerPropertiesComponent } from "./layer-properties.component";
import { AnalyticsDirective } from "../../../directives/analytics.directive";
import { ScrollToDirective } from "../../../directives/scroll-to.directive";
import { ResourcesService } from "../../../services/resources.service";
import { LayersService } from "../../../services/layers.service";
import { RunningContextService } from "../../../services/running-context.service";
import { ToastService } from "../../../services/toast.service";
import type { ApplicationState, EditableLayer, LayerData } from "../../../models";

/**
 * Which list the dialog manages, and the layer whose properties open with it when there is one.
 */
export type ManageLayersDialogData = {
    isOverlay: boolean;
    key?: string;
};

/**
 * The one place to add, edit, share, delete and hide the user's own base layers, or overlays, which keeps the layers
 * panel down to picking a map. Unchecking a layer takes it out of the panel without deleting it.
 */
@Component({
    selector: "manage-layers-dialog",
    templateUrl: "./manage-layers-dialog.component.html",
    imports: [Dir, MatButton, MatIconButton, MatCheckbox, MatTooltip, MatExpansionPanel, MatExpansionPanelContent, CdkCopyToClipboard, MatDialogTitle, MatDialogClose, MatDialogContent, AnalyticsDirective, LayerPropertiesComponent]
})
export class ManageLayersDialogComponent {
    public readonly resources = inject(ResourcesService);

    private readonly layersService = inject(LayersService);
    private readonly toastService = inject(ToastService);
    private readonly store = inject(Store);

    private readonly data = inject<ManageLayersDialogData>(MAT_DIALOG_DATA);
    public readonly isOverlay = this.data.isOverlay;
    public readonly layers = this.store.selectSignal((state: ApplicationState) =>
        this.isOverlay ? state.layersState.overlays : state.layersState.baseLayers);
    /** The key of the layer whose properties are open, null for a layer being added, or no value when none is. */
    public readonly editing = signal<{ key: string | null }>(this.data.key ? { key: this.data.key } : null);

    public readonly copiedKey = signal<string>(null);
    public readonly isApp = inject(RunningContextService).isCapacitor;

    private readonly injector = inject(Injector);

    /**
     * Opens the dialog, with the properties of the given layer already open when there is one.
     */
    public static open(dialog: MatDialog, data: ManageLayersDialogData) {
        dialog.open(ManageLayersDialogComponent, { width: "480px", data, autoFocus: "dialog" });
    }

    constructor() {
        if (this.editing() != null) {
            this.scrollToOpenCardAfterRender();
        }
    }

    public isShownInPanel(layer: Immutable<EditableLayer>): boolean {
        return this.layersService.isShownInPanel(layer, this.isOverlay);
    }

    /**
     * Only the selected base layer is locked, since one has to be selected. An overlay can always be switched off,
     * so hiding a visible one switches it off as well.
     */
    public isLocked(layer: Immutable<EditableLayer>): boolean {
        return !this.isOverlay && this.layersService.isBaseLayerSelected(layer as EditableLayer);
    }

    public setShownInPanel(layer: Immutable<EditableLayer>, shown: boolean) {
        if (this.isOverlay && !shown && this.layersService.isOverlayVisible(layer as EditableLayer)) {
            this.layersService.toggleOverlay(layer as EditableLayer);
        }
        this.layersService.setShownInPanel(layer.key, this.isOverlay, shown);
    }

    public isEditing(key: string | null): boolean {
        return this.editing() != null && this.editing().key === key;
    }

    public toggleEditing(key: string | null) {
        this.editing.set(this.isEditing(key) ? null : { key });
        if (this.editing() != null) {
            this.scrollToOpenCardAfterRender();
        }
    }

    public getShareAddress(layer: Immutable<EditableLayer>): string {
        return this.layersService.layerDataToAddress(layer as LayerData, this.isOverlay);
    }

    public share(layer: Immutable<EditableLayer>) {
        Share.share({ url: this.getShareAddress(layer) });
    }

    public remove(layer: Immutable<EditableLayer>) {
        this.toastService.confirm({
            message: this.resources.areYouSure,
            type: "YesNo",
            confirmAction: () => {
                if (this.isOverlay) {
                    this.layersService.removeOverlay(layer as EditableLayer);
                } else {
                    this.layersService.removeBaseLayer(layer as EditableLayer);
                }
            },
            declineAction: () => { }
        });
    }

    /**
     * The card is only marked as open once the dialog has rendered the change, so the scroll waits for it.
     */
    private scrollToOpenCardAfterRender() {
        afterNextRender(() => this.scrollToOpenCard(), { injector: this.injector });
    }

    /**
     * The id of a layer's card, or of the card for a layer being added when the key is null.
     */
    public getCardId(key: string | null): string {
        return key == null ? "manage-layer-new" : `manage-layer-${key}`;
    }

    private scrollToOpenCard() {
        ScrollToDirective.scrollTo(this.getCardId(this.editing().key));
    }
}
