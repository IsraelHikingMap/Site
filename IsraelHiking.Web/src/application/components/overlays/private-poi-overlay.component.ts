import { Component, inject, input, OnInit, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material/dialog";
import { Dir } from "@angular/cdk/bidi";
import { NgClass } from "@angular/common";

import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { PrivatePoiShowDialogComponent } from "../dialogs/private-poi-show-dialog.component";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/selected-route.service";
import type { MarkerData, LinkData } from "../../models";

@Component({
    selector: "private-poi-overlay",
    templateUrl: "./private-poi-overlay.component.html",
    styleUrls: ["./private-poi-overlay.component.scss"],
    encapsulation: ViewEncapsulation.None,
    imports: [Dir, NgClass]
})
export class PrivatePoiOverlayComponent implements OnInit {

    public marker = input<MarkerData>();
    public routeId? = input<string>();
    public index = input<number>();
    public color = input<string>();

    public imageLink: LinkData;

    public readonly resources = inject(ResourcesService);

    private readonly matDialog = inject(MatDialog);
    private readonly selectedRouteService = inject(SelectedRouteService);

    public ngOnInit(): void {
        this.imageLink = this.marker().urls.find(u => u.mimeType.startsWith("image"));
    }

    public overlayClick(event: Event) {
        event.stopPropagation();

        if (!this.routeId()) {
            PrivatePoiEditDialogComponent.openDialog(this.matDialog, this.marker(), this.index());
            return;
        }

        const selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null) {
            return;
        }
        if (selectedRoute.state === "Route") {
            return;
        }
        if (selectedRoute.id !== this.routeId() || selectedRoute.state === "ReadOnly") {
            PrivatePoiShowDialogComponent.openDialog(this.matDialog, this.marker(), this.routeId(), this.index());
            return;
        }
        if (selectedRoute.state === "Poi") {
            PrivatePoiEditDialogComponent.openDialog(this.matDialog, this.marker(), this.index(), this.routeId());
        }
    }
}
