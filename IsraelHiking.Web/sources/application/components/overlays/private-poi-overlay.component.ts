import { Component, Input, OnInit } from "@angular/core";
import { MatDialog } from "@angular/material";

import { MarkerData, LinkData } from "../../models/models";
import { ResourcesService } from "../../services/resources.service";
import { SelectedRouteService } from "../../services/layers/routelayers/selected-route.service";
import { BaseMapComponent } from "../base-map.component";
import { ImageGalleryService } from "../../services/image-gallery.service";
import { PrivatePoiEditDialogComponent } from "../dialogs/private-poi-edit-dialog.component";

@Component({
    selector: "private-poi-overlay",
    templateUrl: "./private-poi-overlay.component.html",
    styleUrls: ["./private-poi-overlay.component.scss"]
})
export class PrivatePoiOverlayComponent extends BaseMapComponent implements OnInit {

    @Input()
    public marker: MarkerData;

    @Input()
    public routeId: string;

    @Input()
    public index: number;

    public imageLink: LinkData;

    constructor(resources: ResourcesService,
        private readonly matDialog: MatDialog,
        private readonly selectedRouteService: SelectedRouteService,
        private readonly imageGalleryService: ImageGalleryService) {
        super(resources);
    }

    public ngOnInit(): void {
        this.imageLink = this.marker.urls.find(u => u.mimeType.startsWith("image"));
    }

    public overlayClick() {
        let selectedRoute = this.selectedRouteService.getSelectedRoute();
        if (selectedRoute && selectedRoute.id === this.routeId && selectedRoute.state === "Poi") {
            let dialogRef = this.matDialog.open(PrivatePoiEditDialogComponent);
            dialogRef.componentInstance.setMarkerAndRoute(this.marker, this.routeId, this.index);
        } else if (this.imageLink && this.imageLink.url) {
            this.imageGalleryService.setImages([this.imageLink.url]);
        }
    }
}