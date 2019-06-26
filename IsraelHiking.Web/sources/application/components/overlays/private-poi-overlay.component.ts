import { Component, Input, OnInit, ViewEncapsulation } from "@angular/core";
import { MatDialog } from "@angular/material";

import { MarkerData, LinkData } from "../../models/models";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { BaseMapComponent } from "../base-map.component";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";
import { PrivatePoiShowDialogComponent } from "../dialogs/private-poi-show-dialog.component";

@Component({
    selector: "private-poi-overlay",
    templateUrl: "./private-poi-overlay.component.html",
    styleUrls: ["./private-poi-overlay.component.scss"],
    encapsulation: ViewEncapsulation.None
})
export class PrivatePoiOverlayComponent extends BaseMapComponent implements OnInit {

    @Input()
    public marker: MarkerData;

    @Input()
    public routeId: string;

    @Input()
    public index: number;

    @Input()
    public color: string;

    public imageLink: LinkData;

    constructor(resources: ResourcesService,
                private readonly matDialog: MatDialog,
                private readonly selectedRouteService: SelectedRouteService) {
        super(resources);
    }

    public ngOnInit(): void {
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
    }

    public overlayClick(event: Event) {
        event.stopPropagation();
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute == null || selectedRoute.id !== this.routeId) {
            return;
        }
        if (selectedRoute.state === "Poi") {
            PrivatePoiEditDialogComponent.openDialog(this.matDialog, this.marker, this.routeId, this.index);
        } else if (selectedRoute.state === "ReadOnly") {
            PrivatePoiShowDialogComponent.openDialog(this.matDialog, this.marker, this.routeId, this.index);
        }
    }
}
